import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

/**
 * In-memory database for GTFS data
 */
class GTFSDatabase {
  constructor() {
    this.shapes = new Map(); // Map<shape_id, Array<{lat, lon, sequence, distance}>>
    this.stops = new Map(); // Map<stop_id, stop object>
    this.routes = new Map(); // Map<route_id, route object>
    this.trips = new Map(); // Map<trip_id, trip object>
    this.tripsByService = new Map(); // Map<service_id, Array<trip_id>>
    this.calendar = new Map(); // Map<service_id, calendar object>
    this.calendarDates = new Map(); // Map<date, Map<service_id, exception_type>>
  }

  /**
   * Load shapes from shapes.txt file
   */
  async loadShapes(filePath) {
    return new Promise((resolve, reject) => {
      const shapes = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          const shapeId = row.shape_id;
          const point = {
            lat: parseFloat(row.shape_pt_lat),
            lon: parseFloat(row.shape_pt_lon),
            sequence: parseInt(row.shape_pt_sequence),
            distance: parseFloat(row.shape_dist_traveled)
          };

          if (!shapes.has(shapeId)) {
            shapes.set(shapeId, []);
          }
          shapes.get(shapeId).push(point);
        })
        .on('end', () => {
          // Sort points by sequence for each shape
          for (const [shapeId, points] of shapes.entries()) {
            points.sort((a, b) => a.sequence - b.sequence);
          }
          
          this.shapes = shapes;
          console.log(`Loaded ${this.shapes.size} shapes with ${Array.from(this.shapes.values()).reduce((sum, points) => sum + points.length, 0)} total points`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Get all shape IDs
   */
  getAllShapeIds() {
    return Array.from(this.shapes.keys());
  }

  /**
   * Get shape points by ID
   */
  getShape(shapeId) {
    return this.shapes.get(shapeId);
  }

  /**
   * Convert shape points to GeoJSON LineString feature
   */
  shapeToGeoJSON(shapeId, points) {
    if (!points || points.length === 0) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {
        shape_id: shapeId,
        point_count: points.length,
        total_distance: points[points.length - 1].distance
      },
      geometry: {
        type: 'LineString',
        coordinates: points.map(p => [p.lon, p.lat])
      }
    };
  }

  /**
   * Get all shapes as GeoJSON FeatureCollection
   */
  getAllShapesGeoJSON() {
    const features = [];
    
    for (const [shapeId, points] of this.shapes.entries()) {
      const feature = this.shapeToGeoJSON(shapeId, points);
      if (feature) {
        features.push(feature);
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Get single shape as GeoJSON Feature
   */
  getShapeGeoJSON(shapeId) {
    const points = this.getShape(shapeId);
    return this.shapeToGeoJSON(shapeId, points);
  }

  /**
   * Load stops from stops.txt file
   */
  async loadStops(filePath) {
    return new Promise((resolve, reject) => {
      const stops = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          stops.set(row.stop_id, {
            stop_id: row.stop_id,
            stop_name: row.stop_name,
            stop_lat: parseFloat(row.stop_lat),
            stop_lon: parseFloat(row.stop_lon),
            stop_code: row.stop_code,
            stop_desc: row.stop_desc,
            zone_id: row.zone_id,
            stop_url: row.stop_url,
            location_type: row.location_type,
            parent_station: row.parent_station,
            wheelchair_boarding: row.wheelchair_boarding,
            stop_timezone: row.stop_timezone,
            platform_code: row.platform_code,
            tts_stop_name: row.tts_stop_name
          });
        })
        .on('end', () => {
          this.stops = stops;
          console.log(`Loaded ${this.stops.size} stops`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Load routes from routes.txt file
   */
  async loadRoutes(filePath) {
    return new Promise((resolve, reject) => {
      const routes = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          routes.set(row.route_id, {
            route_id: row.route_id,
            agency_id: row.agency_id,
            route_short_name: row.route_short_name,
            route_long_name: row.route_long_name,
            route_type: row.route_type,
            route_desc: row.route_desc,
            route_url: row.route_url,
            route_color: row.route_color,
            route_text_color: row.route_text_color,
            network_id: row.network_id,
            route_sort_order: row.route_sort_order
          });
        })
        .on('end', () => {
          this.routes = routes;
          console.log(`Loaded ${this.routes.size} routes`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Load trips from trips.txt file
   */
  async loadTrips(filePath) {
    return new Promise((resolve, reject) => {
      const trips = new Map();
      const tripsByService = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          const tripId = row.trip_id;
          const serviceId = row.service_id;
          
          trips.set(tripId, {
            trip_id: tripId,
            route_id: row.route_id,
            service_id: serviceId,
            trip_short_name: row.trip_short_name,
            trip_headsign: row.trip_headsign,
            direction_id: row.direction_id,
            block_id: row.block_id,
            shape_id: row.shape_id,
            wheelchair_accessible: row.wheelchair_accessible,
            drt_advance_book_min: row.drt_advance_book_min,
            bikes_allowed: row.bikes_allowed,
            fare_id: row.fare_id,
            peak_offpeak: row.peak_offpeak,
            boarding_type: row.boarding_type
          });
          
          // Build index by service_id
          if (!tripsByService.has(serviceId)) {
            tripsByService.set(serviceId, []);
          }
          tripsByService.get(serviceId).push(tripId);
        })
        .on('end', () => {
          this.trips = trips;
          this.tripsByService = tripsByService;
          console.log(`Loaded ${this.trips.size} trips indexed by ${this.tripsByService.size} services`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Convert stop to GeoJSON Point feature
   */
  stopToGeoJSON(stop) {
    if (!stop) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        stop_code: stop.stop_code,
        stop_desc: stop.stop_desc,
        zone_id: stop.zone_id,
        stop_url: stop.stop_url,
        location_type: stop.location_type,
        parent_station: stop.parent_station,
        wheelchair_boarding: stop.wheelchair_boarding,
        stop_timezone: stop.stop_timezone,
        platform_code: stop.platform_code,
        tts_stop_name: stop.tts_stop_name
      },
      geometry: {
        type: 'Point',
        coordinates: [stop.stop_lon, stop.stop_lat]
      }
    };
  }

  /**
   * Get stop by ID
   */
  getStop(stopId) {
    return this.stops.get(stopId);
  }

  /**
   * Get all stops as GeoJSON FeatureCollection
   */
  getAllStopsGeoJSON() {
    const features = [];
    
    for (const stop of this.stops.values()) {
      const feature = this.stopToGeoJSON(stop);
      if (feature) {
        features.push(feature);
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Get single stop as GeoJSON Feature
   */
  getStopGeoJSON(stopId) {
    const stop = this.getStop(stopId);
    return this.stopToGeoJSON(stop);
  }

  /**
   * Get all stops (raw data)
   */
  getAllStops() {
    return Array.from(this.stops.values());
  }

  /**
   * Get route by ID
   */
  getRoute(routeId) {
    return this.routes.get(routeId);
  }

  /**
   * Get all routes
   */
  getAllRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Get trip by ID
   */
  getTrip(tripId) {
    return this.trips.get(tripId);
  }

  /**
   * Get all trips
   */
  getAllTrips() {
    return Array.from(this.trips.values());
  }

  /**
   * Load calendar from calendar.txt file
   */
  async loadCalendar(filePath) {
    return new Promise((resolve, reject) => {
      const calendar = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          calendar.set(row.service_id, {
            service_id: row.service_id,
            monday: row.monday === '1',
            tuesday: row.tuesday === '1',
            wednesday: row.wednesday === '1',
            thursday: row.thursday === '1',
            friday: row.friday === '1',
            saturday: row.saturday === '1',
            sunday: row.sunday === '1',
            start_date: row.start_date,
            end_date: row.end_date
          });
        })
        .on('end', () => {
          this.calendar = calendar;
          console.log(`Loaded ${this.calendar.size} calendar entries`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Load calendar dates from calendar_dates.txt file
   * Structure: Map<date, Map<service_id, exception_type>>
   */
  async loadCalendarDates(filePath) {
    return new Promise((resolve, reject) => {
      const calendarDates = new Map();
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          const date = row.date;
          const serviceId = row.service_id;
          const exceptionType = parseInt(row.exception_type);
          
          if (!calendarDates.has(date)) {
            calendarDates.set(date, new Map());
          }
          calendarDates.get(date).set(serviceId, exceptionType);
        })
        .on('end', () => {
          this.calendarDates = calendarDates;
          console.log(`Loaded ${this.calendarDates.size} dates with calendar exceptions`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Get trip IDs operating on a specific date
   * @param {string} dateString - Date in YYYYMMDD format
   * @returns {Array<string>} - Array of trip IDs
   */
  getTripsOnDate(dateString) {
    const serviceIds = this.getServicesOnDate(dateString);
    const tripIds = [];
    
    for (const serviceId of serviceIds) {
      const trips = this.tripsByService.get(serviceId);
      if (trips) {
        tripIds.push(...trips);
      }
    }
    
    return tripIds;
  }

  /**
   * Get service IDs operating on a specific date
   * @param {string} dateString - Date in YYYYMMDD format
   * @returns {Array<string>} - Array of service IDs
   */
  getServicesOnDate(dateString) {
    const serviceIds = new Set();
    
    // Parse the date and determine day of week
    const year = parseInt(dateString.substring(0, 4));
    const month = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed
    const day = parseInt(dateString.substring(6, 8));
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Map day of week to calendar field names
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Scan through calendar entries
    for (const [serviceId, calendarEntry] of this.calendar.entries()) {
      // Check if date is within the service period
      if (dateString >= calendarEntry.start_date && dateString <= calendarEntry.end_date) {
        // Check if service operates on this day of week
        if (calendarEntry[dayName]) {
          serviceIds.add(serviceId);
        }
      }
    }
    
    // Apply exceptions from calendar_dates
    const exceptions = this.calendarDates.get(dateString);
    if (exceptions) {
      for (const [serviceId, exceptionType] of exceptions.entries()) {
        if (exceptionType === 1) {
          // Service added for this date
          serviceIds.add(serviceId);
        } else if (exceptionType === 2) {
          // Service removed for this date
          serviceIds.delete(serviceId);
        }
      }
    }
    
    return Array.from(serviceIds);
  }
}

/**
 * Load all GTFS data from the input directory
 */
export async function loadGTFSData(inputDir) {
  const db = new GTFSDatabase();
  
  console.log('Loading GTFS data...');
  
  const shapesPath = path.join(inputDir, 'shapes.txt');
  if (fs.existsSync(shapesPath)) {
    await db.loadShapes(shapesPath);
  } else {
    console.warn(`shapes.txt not found at ${shapesPath}`);
  }

  const stopsPath = path.join(inputDir, 'stops.txt');
  if (fs.existsSync(stopsPath)) {
    await db.loadStops(stopsPath);
  } else {
    console.warn(`stops.txt not found at ${stopsPath}`);
  }

  const routesPath = path.join(inputDir, 'routes.txt');
  if (fs.existsSync(routesPath)) {
    await db.loadRoutes(routesPath);
  } else {
    console.warn(`routes.txt not found at ${routesPath}`);
  }

  const tripsPath = path.join(inputDir, 'trips.txt');
  if (fs.existsSync(tripsPath)) {
    await db.loadTrips(tripsPath);
  } else {
    console.warn(`trips.txt not found at ${tripsPath}`);
  }

  const calendarPath = path.join(inputDir, 'calendar.txt');
  if (fs.existsSync(calendarPath)) {
    await db.loadCalendar(calendarPath);
  } else {
    console.warn(`calendar.txt not found at ${calendarPath}`);
  }

  const calendarDatesPath = path.join(inputDir, 'calendar_dates.txt');
  if (fs.existsSync(calendarDatesPath)) {
    await db.loadCalendarDates(calendarDatesPath);
  } else {
    console.warn(`calendar_dates.txt not found at ${calendarDatesPath}`);
  }
  
  console.log('GTFS data loaded successfully');
  return db;
}

export default GTFSDatabase;
