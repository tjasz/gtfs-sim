import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGTFSData } from './gtfs-loader.js';
import { createStorageProvider } from './storage-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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
 * GET /trips/on/:date
 * Returns trip IDs operating on a specific date
 * Date format: YYYYMMDD
 */
app.get('/trips/on/:date', (req, res) => {
  try {
    const dateString = req.params.date;
    
    // Validate date format
    if (!/^\d{8}$/.test(dateString)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Expected YYYYMMDD (e.g., 20251119)' 
      });
    }
    
    const tripIds = gtfsDB.getTripsOnDate(dateString);
    
    res.json({
      date: dateString,
      trip_count: tripIds.length,
      trip_ids: tripIds
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /services/on/:date
 * Returns service IDs operating on a specific date
 * Date format: YYYYMMDD
 */
app.get('/services/on/:date', (req, res) => {
  try {
    const dateString = req.params.date;
    
    // Validate date format
    if (!/^\d{8}$/.test(dateString)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Expected YYYYMMDD (e.g., 20251119)' 
      });
    }
    
    const serviceIds = gtfsDB.getServicesOnDate(dateString);
    
    res.json({
      date: dateString,
      service_count: serviceIds.length,
      service_ids: serviceIds
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /vehicles/at/:datetime
 * Returns vehicle positions at a specific date and time as a map of trip_id to position
 * DateTime format: ISO 8601 without timezone (e.g., 2025-11-19T09:27:00)
 */
app.get('/vehicles/at/:datetime', (req, res) => {
  try {
    const datetimeStr = req.params.datetime;
    
    // Validate ISO 8601 format (basic check)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(datetimeStr)) {
      return res.status(400).json({ 
        error: 'Invalid datetime format. Expected ISO 8601 format: YYYY-MM-DDTHH:MM:SS (e.g., 2025-11-19T09:27:00)' 
      });
    }
    
    // Parse datetime
    const datetime = new Date(datetimeStr);
    
    if (isNaN(datetime.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid datetime value' 
      });
    }
    
    const vehicles = gtfsDB.getVehiclePositions(datetime);
    
    res.json({
      datetime: datetimeStr,
      vehicle_count: Object.keys(vehicles).length,
      vehicles: vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicle positions:', error);
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
    tripsLoaded: gtfsDB ? gtfsDB.trips.size : 0,
    stopTimesLoaded: gtfsDB ? gtfsDB.stopTimes.size : 0,
    calendarLoaded: gtfsDB ? gtfsDB.calendar.size : 0,
    calendarDatesLoaded: gtfsDB ? gtfsDB.calendarDates.size : 0
  });
});

/**
 * Initialize the server
 */
async function startServer() {
  try {
    // Detect environment: Azure or local
    const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined || process.env.USE_AZURE_STORAGE === 'true';
    
    let storageProvider;
    
    if (isAzure) {
      // Production: Use Azure Blob Storage
      console.log('Running in Azure environment - using Azure Blob Storage');
      
      const accountName = process.env.AZURE_STORAGE_ACCOUNT || 'gtfspugetsound';
      const containerName = process.env.AZURE_STORAGE_CONTAINER || 'puget-sound';
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      
      storageProvider = createStorageProvider({
        type: 'azure',
        accountName: accountName,
        containerName: containerName,
        connectionString: connectionString
      });
      
      console.log(`Using Azure Storage: ${accountName}/${containerName}`);
    } else {
      // Local development: Use file system
      console.log('Running in local environment - using file system');
      
      const inputFolder = process.argv[2] || 'puget_sound';
      const inputDir = path.join(__dirname, '..', 'input', inputFolder);
      
      storageProvider = createStorageProvider({
        type: 'local',
        baseDir: inputDir
      });
      
      console.log(`Using local GTFS data from: ${inputFolder}`);
    }
    
    // Load GTFS data
    gtfsDB = await loadGTFSData(storageProvider);
    
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
      console.log(`  GET /trips/on/:date - Get trip IDs operating on a date (YYYYMMDD)`);
      console.log(`  GET /services/on/:date - Get service IDs operating on a date (YYYYMMDD)`);
      console.log(`  GET /vehicles/at/:datetime - Get vehicle positions at a datetime (ISO 8601)`);
      console.log(`  GET /health - Health check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
