import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
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

function App() {
  const [simulatedTime, setSimulatedTime] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [vehicles, setVehicles] = useState(null);
  const [vehicleCount, setVehicleCount] = useState(0);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

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
      setVehicles(data);
      setVehicleCount(data.features?.length || 0);
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
      return newSpeed > 64 ? 1 : newSpeed; // Cap at 64x, then reset to 1x
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

  // Custom point to layer function for vehicles
  const pointToLayer = (feature, latlng) => {
    const props = feature.properties;
    const routeType = props.route?.route_type ?? 3; // Default to bus if route info missing
    const icon = getVehicleIcon(routeType);
    const marker = L.marker(latlng, { icon });
    
    // Add popup with trip and route info
    let popupContent = '<div style="font-size: 14px;">';
    
    // Route information
    if (props.route) {
      if (props.route.route_short_name || props.route.route_long_name) {
        popupContent += '<strong>';
        if (props.route.route_short_name) {
          popupContent += `Route ${props.route.route_short_name}`;
          if (props.route.route_long_name) {
            popupContent += ': ';
          }
        }
        if (props.route.route_long_name) {
          popupContent += props.route.route_long_name;
        }
        popupContent += '</strong><br/>';
      }
      
      if (props.route.route_id) {
        popupContent += `<small>Route ID: ${props.route.route_id}</small><br/>`;
      }
    }
    
    popupContent += '<hr style="margin: 5px 0;">';
    popupContent += `<strong>Trip ID:</strong> ${props.trip_id}<br/>`;
    popupContent += `<strong>Status:</strong> ${props.status}<br/>`;
    
    if (props.status === 'at_stop') {
      popupContent += `<strong>Stop:</strong> ${props.stop_name}<br/>`;
    } else if (props.status === 'in_transit') {
      popupContent += `<strong>From:</strong> ${props.from_stop_id}<br/>`;
      popupContent += `<strong>To:</strong> ${props.to_stop_id}<br/>`;
    }
    
    if (props.shape_dist_traveled != null) {
      popupContent += `<strong>Distance:</strong> ${props.shape_dist_traveled.toFixed(1)}m`;
    }
    
    popupContent += '</div>';
    
    marker.bindPopup(popupContent);
    return marker;
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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {vehicles && vehicles.features && vehicles.features.length > 0 && (
          <GeoJSON 
            key={JSON.stringify(vehicles)} 
            data={vehicles}
            pointToLayer={pointToLayer}
          />
        )}
      </MapContainer>
    </div>
  );
}

export default App;
