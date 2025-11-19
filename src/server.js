import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGTFSData } from './gtfs-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Global database instance
let gtfsDB = null;

/**
 * GET /shapes
 * Returns all shapes as a GeoJSON FeatureCollection
 */
app.get('/shapes', (req, res) => {
  try {
    const geoJSON = gtfsDB.getAllShapesGeoJSON();
    res.json(geoJSON);
  } catch (error) {
    console.error('Error fetching shapes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /shapes/:id
 * Returns a single shape as a GeoJSON Feature
 */
app.get('/shapes/:id', (req, res) => {
  try {
    const shapeId = req.params.id;
    const geoJSON = gtfsDB.getShapeGeoJSON(shapeId);
    
    if (!geoJSON) {
      return res.status(404).json({ error: `Shape with id '${shapeId}' not found` });
    }
    
    res.json(geoJSON);
  } catch (error) {
    console.error('Error fetching shape:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    shapesLoaded: gtfsDB ? gtfsDB.shapes.size : 0
  });
});

/**
 * Initialize the server
 */
async function startServer() {
  try {
    // Load GTFS data
    const inputDir = path.join(__dirname, '..', 'input', 'puget_sound');
    gtfsDB = await loadGTFSData(inputDir);
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`GTFS Simulation API running on http://localhost:${PORT}`);
      console.log(`Endpoints:`);
      console.log(`  GET /shapes - Get all shapes as GeoJSON`);
      console.log(`  GET /shapes/:id - Get a specific shape as GeoJSON`);
      console.log(`  GET /health - Health check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
