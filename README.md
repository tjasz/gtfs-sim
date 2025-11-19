# GTFS Simulation API

A full-stack web application for simulating public transport vehicles moving along their routes in real-time using GTFS (General Transit Feed Specification) data.

## Project Overview

This project visualizes public transit vehicles as they move along their routes based on GTFS schedule data. The backend loads GTFS data into an in-memory database and provides REST APIs to access route shapes and (future) real-time vehicle positions.

## Features

- **GTFS Data Loading**: Loads GTFS feeds into an in-memory database on startup
- **Shape API**: RESTful endpoints to retrieve transit route shapes as GeoJSON
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
Returns server status and number of shapes loaded.

**Example Response:**
```json
{
  "status": "ok",
  "shapesLoaded": 1234
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

3. Test getting all shapes (Note: this may return a large response):
```bash
curl http://localhost:3000/shapes
```

4. Test getting a specific shape:
```bash
curl http://localhost:3000/shapes/10002005
```

### Using PowerShell

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -Expand Content

# Get specific shape
Invoke-WebRequest -Uri http://localhost:3000/shapes/10002005 | Select-Object -Expand Content
```

### Using a Browser

Simply navigate to:
- `http://localhost:3000/health`
- `http://localhost:3000/shapes/10002005`

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

### GTFS Shapes
The application reads `shapes.txt` files in GTFS format:
- `shape_id`: Unique identifier for the shape
- `shape_pt_lat`: Latitude of the shape point
- `shape_pt_lon`: Longitude of the shape point
- `shape_pt_sequence`: Sequence order of the point
- `shape_dist_traveled`: Distance traveled along the shape

### GeoJSON Output
Shape data is converted to GeoJSON format following the [RFC 7946](https://tools.ietf.org/html/rfc7946) specification:
- Coordinates are in `[longitude, latitude]` order
- LineStrings represent the sequence of points forming a route shape

## Future Enhancements

- Additional GTFS data loading (stops, routes, trips, stop_times)
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
