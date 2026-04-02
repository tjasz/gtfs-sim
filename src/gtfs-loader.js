import { parse } from 'csv-parse';

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the closest point on a line segment to a given point
 * @param {number} px - Point X (longitude)
 * @param {number} py - Point Y (latitude)
 * @param {number} x1 - Segment start X (longitude)
 * @param {number} y1 - Segment start Y (latitude)
 * @param {number} x2 - Segment end X (longitude)
 * @param {number} y2 - Segment end Y (latitude)
 * @returns {Object} - {lon, lat, ratio} where ratio is position along segment [0-1]
 */
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // If segment is a point, return that point
  if (dx === 0 && dy === 0) {
    return { lon: x1, lat: y1, ratio: 0 };
  }
  
  // Calculate projection of point onto line segment
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  
  // Clamp t to [0, 1] to stay within segment
  const tClamped = Math.max(0, Math.min(1, t));
  
  return {
    lon: x1 + tClamped * dx,
    lat: y1 + tClamped * dy,
    ratio: tClamped
  };
}

/**
 * Find the closest point on a shape to a given stop location
 * @param {Array} shapePoints - Array of shape points with {lat, lon, distance}
 * @param {number} stopLat - Stop latitude
 * @param {number} stopLon - Stop longitude
 * @returns {number} - Distance along shape to the closest point
 */
function findClosestPointOnShape(shapePoints, stopLat, stopLon) {
  if (!shapePoints || shapePoints.length === 0) {
    return 0;
  }

  if (shapePoints.length === 1) {
    return shapePoints[0].distance;
  }

  let minDistance = Infinity;
  let closestShapeDistance = 0;

  // Check each segment of the shape
  for (let i = 0; i < shapePoints.length - 1; i++) {
    const p1 = shapePoints[i];
    const p2 = shapePoints[i + 1];
    
    // Find closest point on this segment to the stop
    const closest = closestPointOnSegment(
      stopLon, stopLat,
      p1.lon, p1.lat,
      p2.lon, p2.lat
    );
    
    // Calculate distance from stop to this closest point
    const dist = haversineDistance(stopLat, stopLon, closest.lat, closest.lon);
    
    if (dist < minDistance) {
      minDistance = dist;
      // Interpolate distance along shape based on position along segment
      closestShapeDistance = p1.distance + (p2.distance - p1.distance) * closest.ratio;
    }
  }

  return closestShapeDistance;
}

/**
 * In-memory database for GTFS data
 */
class GTFSDatabase {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
    this.shapes = new Map(); // Map<shape_id, Array<{lat, lon, sequence, distance}>>
    this.stops = new Map(); // Map<stop_id, stop object>
    this.routes = new Map(); // Map<route_id, route object>
    this.trips = new Map(); // Map<trip_id, trip object>
    this.tripsByService = new Map(); // Map<service_id, Array<trip_id>>
    this.stopTimes = new Map(); // Map<trip_id, Array<stop_time>>
    this.calendar = new Map(); // Map<service_id, calendar object>
    this.calendarDates = new Map(); // Map<date, Map<service_id, exception_type>>
  }

  /**
   * Load shapes from shapes.txt file
   */
  async loadShapes(filePath) {
    return new Promise(async (resolve, reject) => {
      const shapes = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
            distance: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : null
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
            
            // Check if any distances are missing or zero (except first point)
            const needsCalculation = points.some((p, i) => 
              i > 0 && (p.distance === null || p.distance === 0)
            );
            
            if (needsCalculation) {
              // Calculate distances for all points
              for (let i = 0; i < points.length; i++) {
                if (i === 0) {
                  points[i].distance = 0;
                } else {
                  const prevPoint = points[i - 1];
                  const distFromPrev = haversineDistance(
                    prevPoint.lat, prevPoint.lon,
                    points[i].lat, points[i].lon
                  );
                  points[i].distance = prevPoint.distance + distFromPrev;
                }
              }
            }
          }
          
          this.shapes = shapes;
          console.log(`Loaded ${this.shapes.size} shapes with ${Array.from(this.shapes.values()).reduce((sum, points) => sum + points.length, 0)} total points`);
          resolve();
        })
        .on('error', reject);
      } catch (error) {
        reject(error);
      }
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
    return new Promise(async (resolve, reject) => {
      const stops = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load routes from routes.txt file
   */
  async loadRoutes(filePath) {
    return new Promise(async (resolve, reject) => {
      const routes = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
            route_type: parseInt(row.route_type),
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
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load trips from trips.txt file
   */
  async loadTrips(filePath) {
    return new Promise(async (resolve, reject) => {
      const trips = new Map();
      const tripsByService = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
      } catch (error) {
        reject(error);
      }
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
   * Get trip IDs for specified route IDs
   * @param {Array<string>} routeIds - Array of route IDs
   * @returns {Array<string>} - Array of trip IDs
   */
  getTripsByRoutes(routeIds) {
    const tripIds = [];
    const routeIdSet = new Set(routeIds);
    
    for (const trip of this.trips.values()) {
      if (routeIdSet.has(trip.route_id)) {
        tripIds.push(trip.trip_id);
      }
    }
    
    return tripIds;
  }

  /**
   * Load calendar from calendar.txt file
   */
  async loadCalendar(filePath) {
    return new Promise(async (resolve, reject) => {
      const calendar = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load calendar dates from calendar_dates.txt file
   * Structure: Map<date, Map<service_id, exception_type>>
   */
  async loadCalendarDates(filePath) {
    return new Promise(async (resolve, reject) => {
      const calendarDates = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
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
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load stop times from stop_times.txt file
   */
  async loadStopTimes(filePath) {
    return new Promise(async (resolve, reject) => {
      const stopTimes = new Map();
      
      try {
        const stream = await this.storageProvider.createReadStream(filePath);
        stream.pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          const tripId = row.trip_id;
          const stopTime = {
            trip_id: tripId,
            stop_id: row.stop_id,
            arrival_time: row.arrival_time,
            departure_time: row.departure_time,
            stop_sequence: parseInt(row.stop_sequence),
            shape_dist_traveled: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : null,
            timepoint: row.timepoint,
            stop_headsign: row.stop_headsign,
            pickup_type: row.pickup_type,
            drop_off_type: row.drop_off_type
          };
          
          if (!stopTimes.has(tripId)) {
            stopTimes.set(tripId, []);
          }
          stopTimes.get(tripId).push(stopTime);
        })
        .on('end', () => {
          // Sort stop times by sequence for each trip
          for (const [tripId, times] of stopTimes.entries()) {
            times.sort((a, b) => a.stop_sequence - b.stop_sequence);
            
            // Check if any distances are missing or zero (except first stop which should be 0)
            const needsCalculation = times.some((t, i) => 
              (i === 0 && t.shape_dist_traveled !== 0 && t.shape_dist_traveled !== null) ? false :
              (t.shape_dist_traveled === null || (i > 0 && t.shape_dist_traveled === 0))
            );
            
            // Also check if corresponding shape needs calculation
            const trip = this.trips.get(tripId);
            const shapePoints = trip?.shape_id ? this.shapes.get(trip.shape_id) : null;
            const shapeNeedsCalculation = shapePoints ? 
              shapePoints.some((p, i) => i > 0 && (p.distance === null || p.distance === 0)) : false;
            
            if (needsCalculation || shapeNeedsCalculation) {
              // Calculate shape_dist_traveled using the shape for accuracy
              for (let i = 0; i < times.length; i++) {
                const currStop = this.stops.get(times[i].stop_id);
                
                if (currStop && shapePoints && shapePoints.length > 0) {
                  // Find closest point on shape to this stop
                  times[i].shape_dist_traveled = findClosestPointOnShape(
                    shapePoints,
                    currStop.stop_lat,
                    currStop.stop_lon
                  );
                } else if (i === 0) {
                  // First stop defaults to 0
                  times[i].shape_dist_traveled = 0;
                } else {
                  // Fallback: calculate point-to-point distance from previous stop
                  const prevStop = this.stops.get(times[i - 1].stop_id);
                  if (prevStop && currStop) {
                    const distFromPrev = haversineDistance(
                      prevStop.stop_lat, prevStop.stop_lon,
                      currStop.stop_lat, currStop.stop_lon
                    );
                    times[i].shape_dist_traveled = times[i - 1].shape_dist_traveled + distFromPrev;
                  } else {
                    times[i].shape_dist_traveled = times[i - 1].shape_dist_traveled;
                  }
                }
              }
            }
          }
          
          this.stopTimes = stopTimes;
          console.log(`Loaded stop times for ${this.stopTimes.size} trips`);
          resolve();
        })
        .on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Convert time string (HH:MM:SS) to seconds since midnight
   * Handles times >= 24:00:00 for trips that run past midnight
   */
  timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
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
   * Get vehicle positions at a specific date and time
   * @param {number} year - Year (e.g., 2025)
   * @param {number} month - Month (1-12)
   * @param {number} day - Day of month (1-31)
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @param {number} second - Second (0-59)
   * @param {Array<string>} routeIds - Optional array of route IDs to filter by
   * @returns {Object} - Map of trip_id to GeoJSON Point feature
   */
  getVehiclePositions(year, month, day, hour, minute, second, routeIds = null) {
    // Get date string in YYYYMMDD format
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}${monthStr}${dayStr}`;
    
    // Get time in seconds since midnight
    const currentSeconds = hour * 3600 + minute * 60 + second;
    
    // Get trips operating on this date
    let tripIds = this.getTripsOnDate(dateString);
    
    // Filter by routes if specified
    if (routeIds && routeIds.length > 0) {
      const routeTripIds = this.getTripsByRoutes(routeIds);
      const routeTripIdSet = new Set(routeTripIds);
      tripIds = tripIds.filter(tripId => routeTripIdSet.has(tripId));
    }
    
    const vehicles = {};
    
    for (const tripId of tripIds) {
      const stopTimes = this.stopTimes.get(tripId);
      if (!stopTimes || stopTimes.length === 0) continue;
      
      const firstStop = stopTimes[0];
      const lastStop = stopTimes[stopTimes.length - 1];
      
      const firstArrival = this.timeToSeconds(firstStop.arrival_time);
      const lastDeparture = this.timeToSeconds(lastStop.departure_time);
      
      // Skip if vehicle hasn't started or has finished
      if (currentSeconds < firstArrival || currentSeconds > lastDeparture) continue;
      
      // Find position
      let position = null;
      
      // Check if at a stop
      for (const stopTime of stopTimes) {
        const arrival = this.timeToSeconds(stopTime.arrival_time);
        const departure = this.timeToSeconds(stopTime.departure_time);
        
        if (currentSeconds >= arrival && currentSeconds <= departure) {
          // Vehicle is at this stop
          const stop = this.stops.get(stopTime.stop_id);
          if (stop) {
            // Get trip and route information
            const trip = this.trips.get(tripId);
            const route = trip ? this.routes.get(trip.route_id) : null;
            
            position = {
              type: 'Feature',
              properties: {
                trip_id: tripId,
                trip_headsign: trip ? trip.trip_headsign : null,
                  route: {
                    route_id: route ? route.route_id : null,
                    route_short_name: route ? route.route_short_name : null,
                    route_long_name: route ? route.route_long_name : null,
                    route_type: route ? route.route_type : null
                  },
                stop_id: stopTime.stop_id,
                stop_name: stop.stop_name,
                shape_dist_traveled: stopTime.shape_dist_traveled,
                status: 'at_stop'
              },
              geometry: {
                type: 'Point',
                coordinates: [stop.stop_lon, stop.stop_lat]
              }
            };
          }
          break;
        }
      }
      
      // If not at a stop, interpolate between stops
      if (!position) {
        for (let i = 0; i < stopTimes.length - 1; i++) {
          const fromStop = stopTimes[i];
          const toStop = stopTimes[i + 1];
          
          const fromDeparture = this.timeToSeconds(fromStop.departure_time);
          const toArrival = this.timeToSeconds(toStop.arrival_time);
          
          if (currentSeconds > fromDeparture && currentSeconds < toArrival) {
            // Vehicle is between these two stops
            const timeElapsed = currentSeconds - fromDeparture;
            const totalTime = toArrival - fromDeparture;
            const timeRatio = timeElapsed / totalTime;
            
            // Calculate expected distance
            const fromDistance = fromStop.shape_dist_traveled;
            const toDistance = toStop.shape_dist_traveled;
            const expectedDistance = fromDistance + (toDistance - fromDistance) * timeRatio;
            
            // Get the trip's shape
            const trip = this.trips.get(tripId);
            if (!trip || !trip.shape_id) continue;
            
            const shapePoints = this.shapes.get(trip.shape_id);
            if (!shapePoints || shapePoints.length === 0) continue;
            
            // Find shape points surrounding the expected distance
            let beforePoint = null;
            let afterPoint = null;
            
            for (let j = 0; j < shapePoints.length - 1; j++) {
              if (shapePoints[j].distance <= expectedDistance && 
                  shapePoints[j + 1].distance >= expectedDistance) {
                beforePoint = shapePoints[j];
                afterPoint = shapePoints[j + 1];
                break;
              }
            }
            
            if (beforePoint && afterPoint) {
              // Interpolate position on the shape
              const distDiff = afterPoint.distance - beforePoint.distance;
              const distRatio = distDiff > 0 ? 
                (expectedDistance - beforePoint.distance) / distDiff : 0;
              
              const lat = beforePoint.lat + (afterPoint.lat - beforePoint.lat) * distRatio;
              const lon = beforePoint.lon + (afterPoint.lon - beforePoint.lon) * distRatio;
              
              // Get route information and stop names
              const route = trip ? this.routes.get(trip.route_id) : null;
              const fromStopData = this.stops.get(fromStop.stop_id);
              const toStopData = this.stops.get(toStop.stop_id);
              
              position = {
                type: 'Feature',
                properties: {
                  trip_id: tripId,
                  trip_headsign: trip ? trip.trip_headsign : null,
                  route: {
                    route_id: route ? route.route_id : null,
                    route_short_name: route ? route.route_short_name : null,
                    route_long_name: route ? route.route_long_name : null,
                    route_type: route ? route.route_type : null
                  },
                  shape_dist_traveled: expectedDistance,
                  from_stop_id: fromStop.stop_id,
                  from_stop_name: fromStopData ? fromStopData.stop_name : null,
                  to_stop_id: toStop.stop_id,
                  to_stop_name: toStopData ? toStopData.stop_name : null,
                  status: 'in_transit'
                },
                geometry: {
                  type: 'Point',
                  coordinates: [lon, lat]
                }
              };
            }
            break;
          }
        }
      }
      
      if (position) {
        vehicles[tripId] = position;
      }
    }
    
    return vehicles;
  }

  /**
   * Get one-seat rides (direct trips) between an origin and destination on a given date
   * @param {string} dateString - Date in YYYYMMDD format
   * @param {{lat: number, lon: number}} originLatLon - Origin coordinates
   * @param {{lat: number, lon: number}} destinationLatLon - Destination coordinates
   * @param {number} threshold - Maximum distance in meters from origin/destination to stops
   * @returns {Array<Object>} - Array of { route, trip, origin: { ...stop, stop_time }, destination: { ...stop, stop_time } }
   */
  getOneSeatRidesOnDate(dateString, originLatLon, destinationLatLon, threshold) {
    const tripIds = this.getTripsOnDate(dateString);
    const results = [];

    for (const tripId of tripIds) {
      const stopTimes = this.stopTimes.get(tripId);
      if (!stopTimes || stopTimes.length < 2) continue;

      // Find the closest origin and destination stops within threshold
      let bestOrigin = null;
      let bestOriginDist = Infinity;
      let bestDest = null;
      let bestDestDist = Infinity;

      for (const st of stopTimes) {
        const stop = this.stops.get(st.stop_id);
        if (!stop) continue;

        const originDist = haversineDistance(originLatLon.lat, originLatLon.lon, stop.stop_lat, stop.stop_lon);
        if (originDist <= threshold && originDist < bestOriginDist) {
          bestOriginDist = originDist;
          bestOrigin = { stop, stopTime: st };
        }

        const destDist = haversineDistance(destinationLatLon.lat, destinationLatLon.lon, stop.stop_lat, stop.stop_lon);
        if (destDist <= threshold && destDist < bestDestDist) {
          bestDestDist = destDist;
          bestDest = { stop, stopTime: st };
        }
      }

      // Must have both, and origin must come before destination in the sequence
      if (!bestOrigin || !bestDest) continue;
      if (bestOrigin.stopTime.stop_sequence >= bestDest.stopTime.stop_sequence) continue;

      const trip = this.trips.get(tripId);
      const route = trip ? this.routes.get(trip.route_id) : null;

      results.push({
        route: route ? { ...route } : null,
        trip: { ...trip },
        origin: {
          ...bestOrigin.stop,
          stop_time: { ...bestOrigin.stopTime }
        },
        destination: {
          ...bestDest.stop,
          stop_time: { ...bestDest.stopTime }
        }
      });
    }

    return results;
  }

  /**
   * Get two-seat (one-transfer) rides between an origin and destination on a given date.
   * Uses a geographic grid index for efficient spatial matching of transfer stops.
   * Returns origin trips with their transfer points and all possible continuation trips.
   * @param {string} dateString - Date in YYYYMMDD format
   * @param {{lat: number, lon: number}} originLatLon - Origin coordinates
   * @param {{lat: number, lon: number}} destinationLatLon - Destination coordinates
   * @param {number} threshold - Maximum distance in meters for stop proximity
   * @returns {Array<Object>} - Array of rides with transfers and continuations
   */
  getTwoSeatRidesOnDate(dateString, originLatLon, destinationLatLon, threshold) {
    const tripIds = this.getTripsOnDate(dateString);

    // Geographic grid index helpers
    const cellSize = threshold / 111000; // approximate degrees per threshold meters
    const getCell = (lat, lon) => `${Math.floor(lat / cellSize)},${Math.floor(lon / cellSize)}`;
    const getNearbyCells = (lat, lon) => {
      const cLat = Math.floor(lat / cellSize);
      const cLon = Math.floor(lon / cellSize);
      const cells = [];
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLon = -1; dLon <= 1; dLon++) {
          cells.push(`${cLat + dLat},${cLon + dLon}`);
        }
      }
      return cells;
    };

    // Find stops near origin and destination
    const originStopDists = new Map();
    const destStopDists = new Map();
    for (const stop of this.stops.values()) {
      const oDist = haversineDistance(originLatLon.lat, originLatLon.lon, stop.stop_lat, stop.stop_lon);
      if (oDist <= threshold) originStopDists.set(stop.stop_id, oDist);
      const dDist = haversineDistance(destinationLatLon.lat, destinationLatLon.lon, stop.stop_lat, stop.stop_lon);
      if (dDist <= threshold) destStopDists.set(stop.stop_id, dDist);
    }

    // Identify candidate origin trips (stop near origin + subsequent transfer stops)
    // and candidate destination trips (stop near destination + preceding transfer stops)
    const candidateOriginTrips = [];
    const candidateDestTrips = [];

    for (const tripId of tripIds) {
      const stopTimes = this.stopTimes.get(tripId);
      if (!stopTimes || stopTimes.length < 2) continue;

      // Origin trip: closest stop to origin within threshold
      let bestOriginST = null;
      let bestOriginDist = Infinity;
      for (const st of stopTimes) {
        if (originStopDists.has(st.stop_id) && originStopDists.get(st.stop_id) < bestOriginDist) {
          bestOriginDist = originStopDists.get(st.stop_id);
          bestOriginST = st;
        }
      }
      if (bestOriginST) {
        const transferSTs = stopTimes.filter(st => st.stop_sequence > bestOriginST.stop_sequence);
        if (transferSTs.length > 0) {
          candidateOriginTrips.push({ tripId, originST: bestOriginST, transferSTs });
        }
      }

      // Destination trip: closest stop to destination within threshold
      let bestDestST = null;
      let bestDestDist = Infinity;
      for (const st of stopTimes) {
        if (destStopDists.has(st.stop_id) && destStopDists.get(st.stop_id) < bestDestDist) {
          bestDestDist = destStopDists.get(st.stop_id);
          bestDestST = st;
        }
      }
      if (bestDestST) {
        const transferSTs = stopTimes.filter(st => st.stop_sequence < bestDestST.stop_sequence);
        if (transferSTs.length > 0) {
          candidateDestTrips.push({ tripId, destST: bestDestST, transferSTs });
        }
      }
    }

    // Build spatial index of destination trip transfer stops
    // cell -> [{destIdx, stopTime, stop}]
    const destTransferGrid = new Map();
    for (let di = 0; di < candidateDestTrips.length; di++) {
      for (const st of candidateDestTrips[di].transferSTs) {
        const stop = this.stops.get(st.stop_id);
        if (!stop) continue;
        const cell = getCell(stop.stop_lat, stop.stop_lon);
        if (!destTransferGrid.has(cell)) destTransferGrid.set(cell, []);
        destTransferGrid.get(cell).push({ destIdx: di, stopTime: st, stop });
      }
    }

    // For each origin trip, find all transfer stops that connect to destination trips
    const rides = [];

    for (const ot of candidateOriginTrips) {
      // Map: origin transfer stop_id -> { stopTime, stop, continuations: [] }
      const transferMap = new Map();

      for (const st of ot.transferSTs) {
        const stop = this.stops.get(st.stop_id);
        if (!stop) continue;

        for (const cell of getNearbyCells(stop.stop_lat, stop.stop_lon)) {
          const entries = destTransferGrid.get(cell);
          if (!entries) continue;
          for (const entry of entries) {
            const dist = haversineDistance(stop.stop_lat, stop.stop_lon, entry.stop.stop_lat, entry.stop.stop_lon);
            if (dist > threshold) continue;

            // Only consider if second leg departs within 1 hour of first leg arrival
            const firstLegArrival = this.timeToSeconds(st.arrival_time);
            const secondLegDeparture = this.timeToSeconds(entry.stopTime.departure_time);
            if (secondLegDeparture < firstLegArrival || secondLegDeparture - firstLegArrival > 3600) continue;

            // Found a valid connection: this origin transfer stop connects to a dest trip
            if (!transferMap.has(st.stop_id)) {
              transferMap.set(st.stop_id, { stopTime: st, stop, continuations: [] });
            }

            const destTrip = candidateDestTrips[entry.destIdx];
            const destTripData = this.trips.get(destTrip.tripId);
            const destRoute = destTripData ? this.routes.get(destTripData.route_id) : null;
            const destStop = this.stops.get(destTrip.destST.stop_id);

            transferMap.get(st.stop_id).continuations.push({
              route: destRoute ? { ...destRoute } : null,
              trip: { ...destTripData },
              transfer_stop: { ...entry.stop, stop_time: { ...entry.stopTime } },
              destination: { ...destStop, stop_time: { ...destTrip.destST } }
            });
          }
        }
      }

      if (transferMap.size === 0) continue;

      const trip = this.trips.get(ot.tripId);
      const route = trip ? this.routes.get(trip.route_id) : null;
      const originStop = this.stops.get(ot.originST.stop_id);

      const transfers = [];
      for (const transfer of transferMap.values()) {
        transfers.push({
          transfer_stop: { ...transfer.stop, stop_time: { ...transfer.stopTime } },
          continuations: transfer.continuations
        });
      }

      rides.push({
        route: route ? { ...route } : null,
        trip: { ...trip },
        origin: { ...originStop, stop_time: { ...ot.originST } },
        transfers
      });
    }

    return rides;
  }

  /**
   * Get service IDs operating on a specific date
   * @param {string} dateString - Date in YYYYMMDD format
   * @returns {Array<string>} - Array of service IDs
   */
  getServicesOnDate(dateString) {
    const serviceIds = new Set();
    
    // Parse the date and determine day of week
    const yearInt = parseInt(dateString.substring(0, 4));
    const monthInt = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed
    const dayInt = parseInt(dateString.substring(6, 8));
    const date = new Date(yearInt, monthInt, dayInt);
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
 * Load all GTFS data using the provided storage provider
 * @param {StorageProvider} storageProvider - Storage provider instance
 */
export async function loadGTFSData(storageProvider) {
  const db = new GTFSDatabase(storageProvider);
  
  console.log('Loading GTFS data...');
  
  // List of GTFS files to load
  const files = [
    { name: 'shapes.txt', loader: (path) => db.loadShapes(path) },
    { name: 'stops.txt', loader: (path) => db.loadStops(path) },
    { name: 'routes.txt', loader: (path) => db.loadRoutes(path) },
    { name: 'trips.txt', loader: (path) => db.loadTrips(path) },
    { name: 'calendar.txt', loader: (path) => db.loadCalendar(path) },
    { name: 'calendar_dates.txt', loader: (path) => db.loadCalendarDates(path) },
    { name: 'stop_times.txt', loader: (path) => db.loadStopTimes(path) }
  ];
  
  // Load each file if it exists
  for (const file of files) {
    if (await storageProvider.exists(file.name)) {
      await file.loader(file.name);
    } else {
      console.warn(`${file.name} not found`);
    }
  }
  
  console.log('GTFS data loaded successfully');
  return db;
}

export default GTFSDatabase;
