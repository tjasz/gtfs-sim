import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

/**
 * In-memory database for GTFS data
 */
class GTFSDatabase {
  constructor() {
    this.shapes = new Map(); // Map<shape_id, Array<{lat, lon, sequence, distance}>>
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
  
  console.log('GTFS data loaded successfully');
  return db;
}

export default GTFSDatabase;
