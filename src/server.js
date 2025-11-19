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
 * GET /stops
 * Returns all stops as a GeoJSON FeatureCollection
 */
app.get('/stops', (req, res) => {
  try {
    const geoJSON = gtfsDB.getAllStopsGeoJSON();
    res.json(geoJSON);
  } catch (error) {
    console.error('Error fetching stops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /stops/:id
 * Returns a single stop as a GeoJSON Feature
 */
app.get('/stops/:id', (req, res) => {
  try {
    const stopId = req.params.id;
    const geoJSON = gtfsDB.getStopGeoJSON(stopId);
    
    if (!geoJSON) {
      return res.status(404).json({ error: `Stop with id '${stopId}' not found` });
    }
    
    res.json(geoJSON);
  } catch (error) {
    console.error('Error fetching stop:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /routes
 * Returns all routes
 */
app.get('/routes', (req, res) => {
  try {
    const routes = gtfsDB.getAllRoutes();
    res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /routes/:id
 * Returns a single route by ID
 */
app.get('/routes/:id', (req, res) => {
  try {
    const routeId = req.params.id;
    const route = gtfsDB.getRoute(routeId);
    
    if (!route) {
      return res.status(404).json({ error: `Route with id '${routeId}' not found` });
    }
    
    res.json(route);
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trips
 * Returns all trips
 */
app.get('/trips', (req, res) => {
  try {
    const trips = gtfsDB.getAllTrips();
    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trips/:id
 * Returns a single trip by ID
 */
app.get('/trips/:id', (req, res) => {
  try {
    const tripId = req.params.id;
    const trip = gtfsDB.getTrip(tripId);
    
    if (!trip) {
      return res.status(404).json({ error: `Trip with id '${tripId}' not found` });
    }
    
    res.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    shapesLoaded: gtfsDB ? gtfsDB.shapes.size : 0,
    stopsLoaded: gtfsDB ? gtfsDB.stops.size : 0,
    routesLoaded: gtfsDB ? gtfsDB.routes.size : 0,
    tripsLoaded: gtfsDB ? gtfsDB.trips.size : 0
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
      console.log(`  GET /stops - Get all stops`);
      console.log(`  GET /stops/:id - Get a specific stop`);
      console.log(`  GET /routes - Get all routes`);
      console.log(`  GET /routes/:id - Get a specific route`);
      console.log(`  GET /trips - Get all trips`);
      console.log(`  GET /trips/:id - Get a specific trip`);
      console.log(`  GET /health - Health check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
