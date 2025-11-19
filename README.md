# GTFS Simulation API

A full-stack web application for simulating public transport vehicles moving along their routes in real-time using GTFS (General Transit Feed Specification) data.

## Project Overview

This project visualizes public transit vehicles as they move along their routes based on GTFS schedule data. The backend loads GTFS data into an in-memory database and provides REST APIs to access route shapes and (future) real-time vehicle positions.

## Features

- **GTFS Data Loading**: Loads GTFS feeds into an in-memory database on startup
- **GeoJSON APIs**: RESTful endpoints to retrieve transit data as GeoJSON
  - Shapes as LineString features
  - Stops as Point features
  - Routes and trips as standard JSON
- **Fast In-Memory Database**: Quick access to transit data without external dependencies

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd c:\Users\Nukor\repos\gtfs-sim
```

2. Install dependencies:
```bash
npm install
```

## Project Structure

```
gtfs-sim/
├── src/
│   ├── server.js          # Express server and API endpoints
│   └── gtfs-loader.js     # GTFS data loader and in-memory database
├── input/
│   └── puget_sound/       # GTFS data files
│       ├── shapes.txt
│       ├── stops.txt
│       ├── routes.txt
│       └── ...
├── package.json
└── README.md
```

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

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
  "tripsLoaded": 104222
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
```

### Using a Browser

Simply navigate to:
- `http://localhost:3000/health`
- `http://localhost:3000/shapes/10002005`
- `http://localhost:3000/stops/1-100`
- `http://localhost:3000/routes/100001`
- `http://localhost:3000/trips/347619649`

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
The application expects GTFS files to be in `input/puget_sound/`. To use a different directory, modify the `inputDir` path in `src/server.js`.

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

### GeoJSON Output
Shape data is converted to GeoJSON format following the [RFC 7946](https://tools.ietf.org/html/rfc7946) specification:
- Coordinates are in `[longitude, latitude]` order
- LineStrings represent the sequence of points forming a route shape

## Future Enhancements

- Additional GTFS data loading (stop_times, calendar, calendar_dates)
- Vehicle position simulation based on schedules
- Real-time vehicle position endpoints
- WebSocket support for live updates
- React frontend for visualization
- Time acceleration controls for simulation

## Troubleshooting

### Server won't start
- Ensure Node.js v18+ is installed: `node --version`
- Check if port 3000 is already in use
- Verify GTFS files exist in `input/puget_sound/`

### No shapes loaded
- Check that `shapes.txt` exists in the input directory
- Verify the CSV format is correct (comma-separated with headers)
- Check server console logs for error messages

## License

MIT
