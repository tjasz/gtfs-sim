# GTFS Simulation Frontend

React-based frontend application for visualizing real-time public transit vehicle positions using GTFS data.

## Features

- 🗺️ **Interactive Map**: Leaflet-based map with OpenStreetMap tiles
- 🚌 **Live Vehicle Tracking**: Real-time visualization of transit vehicles
- ⏯️ **Simulation Controls**: Play/Pause and speed control (1x-128x)
- 🕐 **Time Display**: Live clock showing simulated time
- 📍 **Vehicle Details**: Click any vehicle to see trip and route information
- 🎨 **Route-Specific Icons**: Different icons for buses, trains, ferries, etc.

## Development

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd client
npm install
```

### Running Locally

```bash
npm run dev
```

The application will start at `http://localhost:5173`.

**Note**: The backend API must be running at `http://localhost:3000` for local development.

### Development with Custom Backend

Edit `.env.development` to point to a different backend:

```env
VITE_API_BASE_URL=https://your-backend.azurewebsites.net
```

## Building for Production

### Configure Backend URL

Edit `.env.production`:

```env
VITE_API_BASE_URL=https://your-backend.azurewebsites.net
VITE_BASE_PATH=/gtfs-sim/
```

### Build

```bash
npm run build:production
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Deployment

### GitHub Pages (Automatic)

Push to `main` branch and GitHub Actions will automatically deploy.

See [FRONTEND_DEPLOYMENT.md](../FRONTEND_DEPLOYMENT.md) for detailed instructions.

### Manual Deployment

```bash
npm run deploy
```

## Configuration

### Environment Variables

- `VITE_API_BASE_URL`: Backend API URL
  - Development: `/api` (proxied to localhost:3000)
  - Production: `https://your-backend.azurewebsites.net`

- `VITE_BASE_PATH`: Application base path
  - Root deployment: `/`
  - Subdirectory: `/repo-name/`

### Files

- `.env.example`: Template with documentation
- `.env.development`: Development configuration (committed)
- `.env.production`: Production configuration (committed)
- `.env.local`: Local overrides (not committed)

## Project Structure

```
client/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── dist/                # Production build output
├── .env.example         # Environment template
├── .env.development     # Development config
├── .env.production      # Production config
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run build:production`: Build with production environment
- `npm run preview`: Preview production build locally
- `npm run deploy`: Build and deploy to GitHub Pages

## Technologies

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Leaflet**: Interactive maps
- **React Leaflet**: React components for Leaflet

## API Integration

The frontend communicates with the backend REST API:

### Endpoints Used

- `GET /vehicles/at/:datetime`: Fetch vehicle positions at specific time

### Request Format

```
GET ${VITE_API_BASE_URL}/vehicles/at/2025-11-19T09:27:00
```

### Response Format

```json
{
  "datetime": "2025-11-19T09:27:00",
  "vehicle_count": 342,
  "vehicles": {
    "trip_id": {
      "type": "Feature",
      "properties": {
        "trip_id": "...",
        "route": { ... },
        "status": "at_stop" | "in_transit",
        ...
      },
      "geometry": {
        "type": "Point",
        "coordinates": [lon, lat]
      }
    }
  }
}
```

## Customization

### Map Center and Zoom

Edit `App.jsx`:

```javascript
const defaultCenter = [47.6062, -122.3321]; // [latitude, longitude]
const defaultZoom = 11;
```

### Update Frequency

Vehicles update every 500ms by default. Edit `App.jsx`:

```javascript
const updateInterval = 500; // milliseconds
```

### Vehicle Icons

Icons are based on GTFS `route_type`. Edit `getVehicleIcon()` in `App.jsx`:

```javascript
const iconMap = {
  0: '🚊', // Tram
  1: '🚇', // Subway
  2: '🚆', // Rail
  3: '🚌', // Bus
  // ... add more
};
```

## Troubleshooting

### Blank Map

**Issue**: Map tiles don't load

**Solution**: Check internet connection and browser console for errors

### No Vehicles

**Issue**: Map loads but shows 0 vehicles

**Solutions**:
1. Verify backend is running and accessible
2. Check `VITE_API_BASE_URL` is correct
3. Open browser console and check for CORS errors
4. Test backend health: `curl https://your-backend.azurewebsites.net/health`

### CORS Errors

**Issue**: "Access to fetch blocked by CORS policy"

**Solutions**:
1. Ensure backend CORS allows your origin
2. Check backend `server.js` CORS configuration
3. Verify frontend origin matches allowed origins

### 404 Errors in Production

**Issue**: Assets return 404 after deployment

**Solution**: Check `VITE_BASE_PATH` matches your deployment URL structure

## Performance

The application is optimized for:

- **Smooth Animation**: 2 updates per second with interpolated movement
- **Efficient Rendering**: Only updates changed markers
- **Memory Management**: Cleans up unused markers
- **Bundle Size**: Code splitting and tree shaking
- **Asset Optimization**: Image and CSS optimization

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT
