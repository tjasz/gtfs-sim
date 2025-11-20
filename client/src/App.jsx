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
  
  // Route information
  if (props.route) {
    if (props.route.route_short_name || props.route.route_long_name) {
      content += '<strong>';
      if (props.route.route_short_name) {
        content += `Route ${props.route.route_short_name}`;
        if (props.route.route_long_name) {
          content += ': ';
        }
      }
      if (props.route.route_long_name) {
        content += props.route.route_long_name;
      }
      content += '</strong><br/>';
    }
    
    if (props.route.route_id) {
      content += `<small>Route ID: ${props.route.route_id}</small><br/>`;
    }
  }
  
  content += '<hr style="margin: 5px 0;">';
  content += `<strong>Trip ID:</strong> ${props.trip_id}<br/>`;
  content += `<strong>Status:</strong> ${props.status}<br/>`;
  
  if (props.status === 'at_stop') {
    content += `<strong>Stop:</strong> ${props.stop_name}<br/>`;
  } else if (props.status === 'in_transit') {
    content += `<strong>From:</strong> ${props.from_stop_id}<br/>`;
    content += `<strong>To:</strong> ${props.to_stop_id}<br/>`;
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

function App() {
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

  const [simulatedTime, setSimulatedTime] = useState(getInitialTime());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [vehicleData, setVehicleData] = useState({});
  const [vehicleCount, setVehicleCount] = useState(0);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
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
      const response = await fetch(`/api/vehicles/at/${isoString}`);
      
      if (!response.ok) {
        console.error('Failed to fetch vehicles:', response.statusText);
        return;
      }
      
      const data = await response.json();
      setVehicleData(data.vehicles || {});
      setVehicleCount(data.vehicle_count || 0);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Update simulation time
  useEffect(() => {
    if (!isPlaying) return;

    const updateInterval = 500; // Update 1 time per second
    
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
  }, [isPlaying, speedMultiplier]);

  // Initialize with current vehicles
  useEffect(() => {
    fetchVehicles(simulatedTime);
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    lastUpdateRef.current = Date.now();
  };

  const handleFastForward = () => {
    setSpeedMultiplier(prev => {
      const newSpeed = prev * 2;
      return newSpeed > 128 ? 1 : newSpeed; // Cap at 128x, then reset to 1x
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
