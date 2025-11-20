# GTFS Simulation API

A full-stack web application for simulating public transport vehicles moving along their routes in real-time using GTFS (General Transit Feed Specification) data.

## Project Overview

This project visualizes public transit vehicles as they move along their routes based on GTFS schedule data. The backend loads GTFS data into an in-memory database and provides REST APIs to access route shapes and (future) real-time vehicle positions.

## Features

### Backend
- **GTFS Data Loading**: Loads GTFS feeds into an in-memory database on startup
- **GeoJSON APIs**: RESTful endpoints to retrieve transit data as GeoJSON
  - Shapes as LineString features
  - Stops as Point features
  - Routes and trips as standard JSON
- **Fast In-Memory Database**: Quick access to transit data without external dependencies
- **Real-time Vehicle Position Calculation**: Interpolates vehicle positions along routes based on schedules

### Frontend
- **Interactive Map**: Leaflet-based map with OpenStreetMap tiles
- **Live Vehicle Tracking**: Real-time visualization of transit vehicles on the map
- **Time Simulation Controls**:
  - Play/Pause simulation
  - Fast-forward with multiple speed settings (1x, 2x, 4x, 8x, 16x, 32x, 64x)
  - Live clock showing simulated time
- **Vehicle Information**: Click on any vehicle to see trip details and current status
- **Automatic Updates**: Fetches vehicle positions twice per second

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd c:\Users\Nukor\repos\gtfs-sim
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
cd ..
```

## Project Structure

```
gtfs-sim/
├── src/
│   ├── server.js          # Express server and API endpoints
│   └── gtfs-loader.js     # GTFS data loader and in-memory database
├── client/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── App.css        # Styles
│   │   └── main.jsx       # React entry point
│   ├── index.html         # HTML template
│   ├── vite.config.js     # Vite configuration
│   └── package.json       # Frontend dependencies
├── input/
│   ├── puget_sound/       # GTFS data files
│   └── pierce_transit/    # Additional GTFS dataset
├── package.json           # Backend dependencies
└── README.md
```

## Running the Application

### Backend Server

#### Development Mode (with auto-reload)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The backend server will start on `http://localhost:3000` by default.

### Frontend Application

In a separate terminal:

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173` and proxy API requests to the backend.

**Note:** Both backend and frontend need to be running simultaneously for the full application to work.

### Selecting Input Data

You can specify which GTFS dataset to load by providing the folder name as an argument:

```bash
# Use Puget Sound data (default)
npm start
# or explicitly
npm run start:puget

# Use Pierce Transit data
npm run start:pierce

# Use custom folder
node src/server.js my_custom_folder
```

The server looks for GTFS files in `input/<folder_name>/`.

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and counts of loaded data.

**Example Response:**
```json
{
  "status": "ok",
  "shapesLoaded": 1206,
  "stopsLoaded": 13172,
  "routesLoaded": 382,
  "tripsLoaded": 104222,
  "stopTimesLoaded": 104222,
  "calendarLoaded": 153,
  "calendarDatesLoaded": 2899
}
```

### Get All Shapes
```
GET /shapes
```
Returns all transit route shapes as a GeoJSON FeatureCollection.

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "shape_id": "10002005",
        "point_count": 342,
        "total_distance": 15234.5
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-122.281769, 47.612137],
          [-122.281784, 47.612144],
          ...
        ]
      }
    },
    ...
  ]
}
```

### Get Shape by ID
```
GET /shapes/:id
```
Returns a single transit route shape as a GeoJSON Feature.

**Example:**
```bash
curl http://localhost:3000/shapes/10002005
```

**Example Response:**
```json
{
  "type": "Feature",
  "properties": {
    "shape_id": "10002005",
    "point_count": 342,
    "total_distance": 15234.5
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-122.281769, 47.612137],
      [-122.281784, 47.612144],
      ...
    ]
  }
}
```

**Error Response (404):**
```json
{
  "error": "Shape with id 'invalid_id' not found"
}
```

### Get All Stops
```
GET /stops
```
Returns all transit stops as a GeoJSON FeatureCollection.

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "stop_id": "1-100",
        "stop_name": "1st Ave & Spring St",
        "stop_code": "100",
        "zone_id": "21",
        "wheelchair_boarding": "1",
        "stop_timezone": "America/Los_Angeles"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-122.336533, 47.605137]
      }
    },
    ...
  ]
}
```

### Get Stop by ID
```
GET /stops/:id
```
Returns a single stop as a GeoJSON Feature.

**Example:**
```bash
curl http://localhost:3000/stops/1-100
```

**Example Response:**
```json
{
  "type": "Feature",
  "properties": {
    "stop_id": "1-100",
    "stop_name": "1st Ave & Spring St",
    "stop_code": "100",
    "zone_id": "21",
    "wheelchair_boarding": "1",
    "stop_timezone": "America/Los_Angeles"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [-122.336533, 47.605137]
  }
}
```

### Get All Routes
```
GET /routes
```
Returns all transit routes.

**Example Response:**
```json
[
  {
    "route_id": "100001",
    "agency_id": "1",
    "route_short_name": "1",
    "route_long_name": "",
    "route_type": "3",
    "route_desc": "Kinnear - Downtown Seattle",
    "route_url": "https://kingcounty.gov/en/dept/metro/routes-and-service/schedules-and-maps/001.html",
    "route_color": "FDB71A",
    "route_text_color": "000000"
  },
  ...
]
```

### Get Route by ID
```
GET /routes/:id
```
Returns a single route by ID.

**Example:**
```bash
curl http://localhost:3000/routes/100001
```

### Get All Trips
```
GET /trips
```
Returns all trips.

**Example Response:**
```json
[
  {
    "trip_id": "347619649",
    "route_id": "102548",
    "service_id": "32350",
    "trip_headsign": "Bellevue Transit Center Crossroads",
    "direction_id": "1",
    "block_id": "7765475",
    "shape_id": "30672005",
    "wheelchair_accessible": "1",
    "bikes_allowed": "1"
  },
  ...
]
```

### Get Trip by ID
```
GET /trips/:id
```
Returns a single trip by ID.

**Example:**
```bash
curl http://localhost:3000/trips/347619649
```

### Get Trips Operating on a Date
```
GET /trips/on/:date
```
Returns all trip IDs that are operating on a specific date. Date must be in YYYYMMDD format.

This endpoint:
1. Uses the service calendar logic to determine active service IDs
2. Looks up all trips associated with those service IDs
3. Returns the trip IDs (not full trip objects)

**Example:**
```bash
curl http://localhost:3000/trips/on/20251119
```

**Example Response:**
```json
{
  "date": "20251119",
  "trip_count": 8234,
  "trip_ids": [
    "347619649",
    "347619659",
    "347619679",
    ...
  ]
}
```

### Get Services Operating on a Date
```
GET /services/on/:date
```
Returns all service IDs that are operating on a specific date. Date must be in YYYYMMDD format.

This endpoint:
1. Checks the calendar to find services with matching weekday and date range
2. Applies exceptions from calendar_dates (additions with type 1, removals with type 2)
3. Returns the final list of active service IDs

**Example:**
```bash
curl http://localhost:3000/services/on/20251119
```

**Example Response:**
```json
{
  "date": "20251119",
  "service_count": 45,
  "service_ids": [
    "121403",
    "137519",
    "140292",
    "141113",
    ...
  ]
}
```

**Error Response (400):**
```json
{
  "error": "Invalid date format. Expected YYYYMMDD (e.g., 20251119)"
}
```

### Get Vehicle Positions at DateTime
```
GET /vehicles/at/:datetime
```
Returns real-time vehicle positions at a specific date and time as a map of trip IDs to GeoJSON Point features. DateTime must be in ISO 8601 format without timezone (agency-local time).

This endpoint:
1. Gets trips operating on the given date
2. For each trip, checks its stop_times sequence
3. Determines if the vehicle is at a stop or between stops
4. For vehicles in transit, interpolates position along the shape based on:
   - Time elapsed between stops
   - Distance traveled along the shape
   - Linear interpolation between shape points

**Example:**
```bash
curl http://localhost:3000/vehicles/at/2025-11-19T09:27:00
```

**Example Response:**
```json
{
  "datetime": "2025-11-19T09:27:00",
  "vehicle_count": 342,
  "vehicles": {
    "347619649": {
      "type": "Feature",
      "properties": {
        "trip_id": "347619649",
        "route": {
          "route_id": "100001",
          "route_short_name": "1",
          "route_long_name": "Kinnear - Downtown Seattle",
          "route_type": 3
        },
        "stop_id": "1-100",
        "stop_name": "1st Ave & Spring St",
        "shape_dist_traveled": 5262.0,
        "status": "at_stop"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-122.336533, 47.605137]
      }
    },
    "347619659": {
      "type": "Feature",
      "properties": {
        "trip_id": "347619659",
        "route": {
          "route_id": "100002",
          "route_short_name": "2",
          "route_long_name": "Queen Anne - Downtown Seattle",
          "route_type": 3
        },
        "shape_dist_traveled": 12543.7,
        "from_stop_id": "1-101",
        "to_stop_id": "1-102",
        "status": "in_transit"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-122.334123, 47.606542]
      }
    }
  }
}
```

**Error Response (400):**
```json
{
  "error": "Invalid datetime format. Expected ISO 8601 format: YYYY-MM-DDTHH:MM:SS (e.g., 2025-11-19T09:27:00)"
}
```

## Testing

### Manual Testing

1. Start the server:
```bash
npm start
```

2. Test the health endpoint:
```bash
curl http://localhost:3000/health
```

3. Test the endpoints (Note: list endpoints may return large responses):
```bash
# Shapes
curl http://localhost:3000/shapes/10002005

# Stops
curl http://localhost:3000/stops/1-100

# Routes
curl http://localhost:3000/routes/100001

# Trips
curl http://localhost:3000/trips/347619649

# Trips on a date
curl http://localhost:3000/trips/on/20251119

# Services on a date
curl http://localhost:3000/services/on/20251119

# Vehicle positions at a specific time
curl http://localhost:3000/vehicles/at/2025-11-19T09:27:00
```

### Using PowerShell

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -Expand Content

# Get specific resources
Invoke-WebRequest -Uri http://localhost:3000/shapes/10002005 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/stops/1-100 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/routes/100001 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/trips/347619649 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/trips/on/20251119 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/services/on/20251119 | Select-Object -Expand Content
Invoke-WebRequest -Uri http://localhost:3000/vehicles/at/2025-11-19T09:27:00 | Select-Object -Expand Content
```

### Using a Browser

Simply navigate to:
- `http://localhost:3000/health`
- `http://localhost:3000/shapes/10002005`
- `http://localhost:3000/stops/1-100`
- `http://localhost:3000/routes/100001`
- `http://localhost:3000/trips/347619649`
- `http://localhost:3000/trips/on/20251119`
- `http://localhost:3000/services/on/20251119`
- `http://localhost:3000/vehicles/at/2025-11-19T09:27:00`

### Using test.http File

The project includes a `test.http` file with predefined API tests. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension in VS Code, then open `test.http` and click "Send Request" above any endpoint to test it.

## Configuration

### Port Configuration
Set the `PORT` environment variable to change the server port:

```bash
# Windows PowerShell
$env:PORT=8080; npm start

# Linux/Mac
PORT=8080 npm start
```

### GTFS Data Directory
The application expects GTFS files to be in subdirectories under `input/`. You can specify which dataset to load using a command-line argument:

```bash
node src/server.js <folder_name>
```

For example:
- `input/puget_sound/` - Sound Transit consolidated puget sound (default)
- `input/pierce_transit/` - Pierce Transit

## Data Format

### GTFS Data
The application reads standard GTFS files:

**Shapes** (`shapes.txt`):
- `shape_id`: Unique identifier for the shape
- `shape_pt_lat`: Latitude of the shape point
- `shape_pt_lon`: Longitude of the shape point
- `shape_pt_sequence`: Sequence order of the point
- `shape_dist_traveled`: Distance traveled along the shape

**Stops** (`stops.txt`):
- `stop_id`: Unique identifier for the stop
- `stop_name`: Name of the stop
- `stop_lat`: Latitude of the stop
- `stop_lon`: Longitude of the stop
- Additional fields: `stop_code`, `zone_id`, `wheelchair_boarding`, etc.

**Routes** (`routes.txt`):
- `route_id`: Unique identifier for the route
- `route_short_name`: Short name (e.g., "1", "10")
- `route_long_name`: Full descriptive name
- `route_type`: Type of transportation (3 = bus)
- Additional fields: `route_color`, `route_url`, etc.

**Trips** (`trips.txt`):
- `trip_id`: Unique identifier for the trip
- `route_id`: Route this trip belongs to
- `service_id`: Service calendar reference
- `shape_id`: Shape this trip follows
- `trip_headsign`: Destination displayed to riders
- Additional fields: `direction_id`, `block_id`, etc.

**Calendar** (`calendar.txt`):
- `service_id`: Unique identifier for the service
- `monday` through `sunday`: Boolean flags for days of week
- `start_date`: First date of service (YYYYMMDD)
- `end_date`: Last date of service (YYYYMMDD)

**Calendar Dates** (`calendar_dates.txt`):
- `service_id`: Service identifier
- `date`: Exception date (YYYYMMDD)
- `exception_type`: 1 = service added, 2 = service removed

### GeoJSON Output
Shape data is converted to GeoJSON format following the [RFC 7946](https://tools.ietf.org/html/rfc7946) specification:
- Coordinates are in `[longitude, latitude]` order
- LineStrings represent the sequence of points forming a route shape

## Future Enhancements

- Vehicle position simulation based on schedules ✅ (Implemented!)
- Time acceleration controls for simulation
- Real-time vehicle position endpoints
- WebSocket support for live updates
- React frontend for visualization
- Time acceleration controls for simulation

## Troubleshooting

### Server won't start
- Ensure Node.js v18+ is installed: `node --version`
- Check if port 3000 is already in use
- Verify GTFS files exist in the specified input folder (default: `input/puget_sound/`)
- Check that the folder name is spelled correctly when using a custom argument

### No shapes loaded
- Check that `shapes.txt` exists in the input directory
- Verify the CSV format is correct (comma-separated with headers)
- Check server console logs for error messages

## Deployment

The application consists of two parts that can be deployed independently:

### Backend Deployment (Azure App Service)

The backend API supports automatic switching between local file system (development) and Azure Blob Storage (production).

**Requirements:**
- Azure Storage Account for hosting GTFS data files
- Azure App Service for hosting the backend API
- System-Assigned Managed Identity configured

**Quick Summary:**
- **Local**: Reads GTFS files from `input/` directory
- **Azure**: Reads GTFS files from Azure Blob Storage using Managed Identity

For detailed backend deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Frontend Deployment (GitHub Pages)

The React frontend can be deployed to GitHub Pages with automatic builds via GitHub Actions.

**Requirements:**
- GitHub repository with Pages enabled
- Backend API deployed and accessible

**Quick Summary:**
- Configure backend URL in `.env.production`
- Push to `main` branch for automatic deployment
- Or use `npm run deploy` for manual deployment

For detailed frontend deployment instructions, see [FRONTEND_DEPLOYMENT.md](FRONTEND_DEPLOYMENT.md).

### Complete Deployment Architecture

```
┌─────────────────────┐
│   GitHub Pages      │
│   (Frontend)        │  ← https://username.github.io/gtfs-sim/
│   React + Leaflet   │
└──────────┬──────────┘
           │ HTTPS API Requests
           ▼
┌─────────────────────┐
│  Azure App Service  │
│   (Backend API)     │  ← https://your-app.azurewebsites.net
│   Express + Node.js │
└──────────┬──────────┘
           │ Managed Identity
           ▼
┌─────────────────────┐
│  Azure Blob Storage │
│   (GTFS Data)       │
└─────────────────────┘
```

## License

MIT
