import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Function to get icon based on route_type
const getVehicleIcon = (routeType) => {
  const iconMap = {
    0: '🚊', // Tram, Streetcar, Light rail
    1: '🚇', // Subway, Metro
    2: '🚆', // Rail
    3: '🚌', // Bus
    4: '⛴️', // Ferry
    5: '🚡', // Cable tram
    6: '🚠', // Aerial lift
    7: '🚞', // Funicular
    11: '🚎', // Trolleybus
    12: '🚝', // Monorail
  };
  
  const emoji = iconMap[routeType] || '🚌'; // Default to bus
  
  return L.divIcon({
    className: 'vehicle-marker',
    html: `<div class="vehicle-icon">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Helper function to create popup content
const createPopupContent = (props) => {
  let content = '<div style="font-size: 14px;">';
  
  // Trip headsign and trip ID
  if (props.trip_headsign) {
    content += `<strong>${props.trip_headsign}</strong><br/>`;
  }
  content += `<small>Trip ID: ${props.trip_id}</small><br/>`;
  
  content += '<hr style="margin: 5px 0;">';
  
  // Route information
  if (props.route) {
    if (props.route.route_short_name) {
      content += `<strong>Route ${props.route.route_short_name}</strong>`;
      if (props.route.route_long_name) {
        content += ': ';
      }
      content += '<br/>';
    }
    if (props.route.route_long_name) {
      content += `${props.route.route_long_name}<br/>`;
    }
    if (props.route.route_id) {
      content += `<small>Route ID: ${props.route.route_id}</small><br/>`;
    }
  }
  
  content += '<hr style="margin: 5px 0;">';
  
  // Status and stop information
  content += `<strong>Status:</strong> ${props.status}<br/>`;
  
  if (props.status === 'at_stop') {
    content += `<strong>Stop:</strong> ${props.stop_name}<br/>`;
    content += `<small>Stop ID: ${props.stop_id}</small><br/>`;
  } else if (props.status === 'in_transit') {
    content += `<strong>From:</strong> ${props.from_stop_name || props.from_stop_id}<br/>`;
    content += `<small>Stop ID: ${props.from_stop_id}</small><br/>`;
    content += `<strong>To:</strong> ${props.to_stop_name || props.to_stop_id}<br/>`;
    content += `<small>Stop ID: ${props.to_stop_id}</small><br/>`;
  }
  
  if (props.shape_dist_traveled != null) {
    content += `<strong>Distance:</strong> ${props.shape_dist_traveled.toFixed(1)}m`;
  }
  
  content += '</div>';
  return content;
};

// Component to manage vehicle markers
function VehicleMarkers({ vehicleData }) {
  const map = useMap();
  const markersRef = useRef({});

  useEffect(() => {
    const currentMarkers = markersRef.current;
    const newVehicles = vehicleData || {};
    
    console.log('Updating markers:', {
      currentMarkerCount: Object.keys(currentMarkers).length,
      newVehicleCount: Object.keys(newVehicles).length
    });
    
    // Remove markers for trips that no longer exist
    Object.keys(currentMarkers).forEach(tripId => {
      if (!newVehicles[tripId]) {
        map.removeLayer(currentMarkers[tripId]);
        delete currentMarkers[tripId];
      }
    });
    
    // Add or update markers
    Object.entries(newVehicles).forEach(([tripId, feature]) => {
      const props = feature.properties;
      const [lon, lat] = feature.geometry.coordinates;
      const latlng = L.latLng(lat, lon);
      
      if (currentMarkers[tripId]) {
        // Update existing marker position
        currentMarkers[tripId].setLatLng(latlng);
        
        // Update popup content
        const popupContent = createPopupContent(props);
        currentMarkers[tripId].getPopup().setContent(popupContent);
      } else {
        // Create new marker
        const routeType = props.route?.route_type ?? 3;
        const icon = getVehicleIcon(routeType);
        const marker = L.marker(latlng, { icon });
        
        const popupContent = createPopupContent(props);
        marker.bindPopup(popupContent);
        
        marker.addTo(map);
        currentMarkers[tripId] = marker;
      }
    });
    
    // Update ref
    markersRef.current = currentMarkers;
  }, [vehicleData, map]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(markersRef.current).forEach(marker => {
        map.removeLayer(marker);
      });
    };
  }, [map]);
  
  return null;
}

// Route type categories and their IDs
const ROUTE_CATEGORIES = {
  'intercity': ['51', '52', '53', '54', '55', '56', '57', '58', '59', '60'],
  'commuter': ['SNDR_EV', 'SNDR_TL'],
  'lightrail': ['100479', '2LINE'],
  'monorail': ['SCM'],
  'streetcar': ['TLINE', '100340', '102638'],
  'brt': ['100512', '102548', '102576', '102581', '102615', '102619', '102745', '102736', '701', '702', '703'],
  'stx': ['1-SHUTTLE','100232','100236','100239','100240','100451','100511','102734','510','512','513','515','532','535','560','574','577','578','580','586','590','592','594','595','596'],
  'fastferry': ['100336','100337','20-400','20-402','20-500','20-501','401','403','404','405'],
  'ferry': ['1013','1015','1018','110','1117','113','115','118','128','131','1310','1315','1318','145','151','1510','1513','1518','1621','1711','1810','1813','1815','2022','2116','2220','37','514','73','74','812','920','922','95-101','95-181','95-209','95-229','95-47',],
};

const ROUTE_CATEGORY_FRIENDLY_NAMES = {
  'intercity': 'Intercity Rail',
  'commuter': 'Commuter Rail',
  'lightrail': 'Light Rail',
  'monorail': 'Monorail',
  'streetcar': 'Streetcar',
  'brt': 'Bus Rapid Transit',
  'stx': 'Sound Transit Express',
  'fastferry': 'Fast Ferry/Water Taxi',
  'ferry': 'Ferry',
};

function App() {
  // Get API base URL from environment variable
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
  
  // Get initial time from query parameter or use current time
  const getInitialTime = () => {
    const params = new URLSearchParams(window.location.search);
    const startDate = params.get('startDate');
    
    if (startDate) {
      const parsedDate = new Date(startDate);
      // Check if valid date
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    
    return new Date();
  };

  // Get initial route selection from query parameter
  const getInitialRouteSelection = () => {
    const params = new URLSearchParams(window.location.search);
    const routesParam = params.get('routes');
    console.log(routesParam);
    
    if (routesParam) {
      // Parse comma-separated route category names
      const categoryNames = routesParam.split(',').map(name => name.trim().toLowerCase());
      
      // Filter to only include valid category names
      const validCategories = categoryNames.filter(name => 
        Object.keys(ROUTE_CATEGORIES).includes(name)
      );
      
      if (validCategories.length > 0) {
        return {
          selectedRouteTypes: new Set(validCategories),
          includeOtherRoutes: false
        };
      }
    }
    
    // Default: all categories selected
    return {
      selectedRouteTypes: new Set(Object.keys(ROUTE_CATEGORIES)),
      includeOtherRoutes: true
    };
  };

  const initialRouteSelection = getInitialRouteSelection();

  const [simulatedTime, setSimulatedTime] = useState(getInitialTime());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [vehicleData, setVehicleData] = useState({});
  const [vehicleCount, setVehicleCount] = useState(0);
  const [selectedRouteTypes, setSelectedRouteTypes] = useState(initialRouteSelection.selectedRouteTypes);
  const [includeOtherRoutes, setIncludeOtherRoutes] = useState(initialRouteSelection.includeOtherRoutes);
  const [showRouteFilter, setShowRouteFilter] = useState(false);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const lastVehicleUpdateTimeRef = useRef(null);
  const mapRef = useRef(null);

  // Default map center (Seattle area)
  const defaultCenter = [47.6062, -122.3321];
  const defaultZoom = 11;

  // Fetch vehicles from API
  const fetchVehicles = async (datetime) => {
    try {
      // Format datetime as ISO 8601 without timezone
      // Sweden locale format is YYYY-MM-DD HH:MM:SS
      const isoString = datetime.toLocaleString('sv').replace(' ', 'T');
      
      // If "All Other Routes" is selected, don't filter by routes
      let url;
      if (includeOtherRoutes) {
        url = `${API_BASE_URL}/vehicles/at/${isoString}`;
      } else {
        // Build route IDs from selected categories
        const routeIds = [];
        selectedRouteTypes.forEach(categoryName => {
          routeIds.push(...ROUTE_CATEGORIES[categoryName]);
        });
        
        // Add routes parameter if any categories are selected
        url = routeIds.length > 0 
          ? `${API_BASE_URL}/vehicles/at/${isoString}?routes=${routeIds.join(',')}`
          : `${API_BASE_URL}/vehicles/at/${isoString}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Failed to fetch vehicles:', response.statusText);
        return;
      }
      
      const data = await response.json();
      
      // Only update if this response is newer than the last update
      const responseDateTime = new Date(data.datetime);
      if (lastVehicleUpdateTimeRef.current && responseDateTime < lastVehicleUpdateTimeRef.current) {
        console.log('Ignoring stale vehicle data:', data.datetime);
        return;
      }
      
      lastVehicleUpdateTimeRef.current = responseDateTime;
      setVehicleData(data.vehicles || {});
      setVehicleCount(data.vehicle_count || 0);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Update simulation time
  useEffect(() => {
    if (!isPlaying) return;

    const updateInterval = 250; // Update 4 times per second
    
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastUpdateRef.current;
      lastUpdateRef.current = now;
      
      // Calculate simulated time progression
      const simulatedElapsed = elapsed * speedMultiplier;
      
      setSimulatedTime(prevTime => {
        const newTime = new Date(prevTime.getTime() + simulatedElapsed);
        // Fetch vehicles at the new time
        fetchVehicles(newTime);
        return newTime;
      });
    }, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speedMultiplier, selectedRouteTypes]);

  // Initialize with current vehicles
  useEffect(() => {
    fetchVehicles(simulatedTime);
  }, [selectedRouteTypes, includeOtherRoutes]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    lastUpdateRef.current = Date.now();
  };

  const handleFastForward = () => {
    const speedOptions = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60, 120];
    setSpeedMultiplier(prev => {
      const currentIndex = speedOptions.indexOf(prev);
      const nextIndex = (currentIndex + 1) % speedOptions.length;
      return speedOptions[nextIndex];
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleRouteTypeToggle = (categoryName) => {
    setSelectedRouteTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const handleSelectAllRoutes = () => {
    setSelectedRouteTypes(new Set(Object.keys(ROUTE_CATEGORIES)));
    setIncludeOtherRoutes(true);
  };

  const handleDeselectAllRoutes = () => {
    setSelectedRouteTypes(new Set());
    setIncludeOtherRoutes(false);
  };

  return (
    <div className="app">
      <div className="controls">
        <div className="time-display">
          <div className="date">{formatDate(simulatedTime)}</div>
          <div className="time">{formatTime(simulatedTime)}</div>
        </div>
        
        <div className="control-buttons">
          <button 
            className="control-btn"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button 
            className="control-btn"
            onClick={handleFastForward}
            title="Fast Forward (cycle through speeds)"
          >
            ⏩
          </button>
          
          <div className="speed-indicator">
            {speedMultiplier}x
          </div>
        </div>
        
        <div className="vehicle-count">
          {vehicleCount} vehicles
        </div>
        
        <div className="route-filter">
          <button 
            className="filter-toggle-btn"
            onClick={() => setShowRouteFilter(!showRouteFilter)}
            title="Filter by route type"
          >
            🚆 Filter ({includeOtherRoutes ? 'All' : `${selectedRouteTypes.size}/${Object.keys(ROUTE_CATEGORIES).length}`})
          </button>
          
          {showRouteFilter && (
            <div className="filter-dropdown">
              <div className="filter-header">
                <strong>Route Types</strong>
                <div className="filter-actions">
                  <button onClick={handleSelectAllRoutes} className="filter-action-btn">All</button>
                  <button onClick={handleDeselectAllRoutes} className="filter-action-btn">None</button>
                </div>
              </div>
              {Object.keys(ROUTE_CATEGORIES).map(categoryName => (
                <label key={categoryName} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedRouteTypes.has(categoryName)}
                    onChange={() => handleRouteTypeToggle(categoryName)}
                  />
                  <span>{ROUTE_CATEGORY_FRIENDLY_NAMES[categoryName]}</span>
                </label>
              ))}
              <label className="filter-checkbox filter-checkbox-disabled">
                <input
                  type="checkbox"
                  checked={includeOtherRoutes}
                  disabled
                />
                <span>All Other Routes</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={defaultZoom} 
        className="map-container"
        zoomControl={true}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <VehicleMarkers vehicleData={vehicleData} />
      </MapContainer>
    </div>
  );
}

export default App;
