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
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          trips.set(row.trip_id, {
            trip_id: row.trip_id,
            route_id: row.route_id,
            service_id: row.service_id,
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
        })
        .on('end', () => {
          this.trips = trips;
          console.log(`Loaded ${this.trips.size} trips`);
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * Get stop by ID
   */
  getStop(stopId) {
    return this.stops.get(stopId);
  }

  /**
   * Get all stops
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
  
  console.log('GTFS data loaded successfully');
  return db;
}

export default GTFSDatabase;
