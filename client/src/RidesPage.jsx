import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './RidesPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Parse a time string (HH:MM:SS, may be >=24:00:00) to seconds since midnight.
 */
function timeToSeconds(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Format seconds since midnight back to HH:MM.
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Haversine distance in meters between two lat/lon points.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build the interleaved schedule rows from origin and destination trips.
 *
 * Origin trips sorted by departure from origin.
 * Destination trips sorted by departure from transfer.
 *
 * A destination trip is feasible after an origin trip if:
 *   destTransferDeparture >= originTransferArrival + transferBuffer + walkTime
 *
 * Each destination trip is placed after the latest origin trip it's feasible for
 * (i.e. the origin trip whose transfer arrival is latest but still allows the connection).
 */
function buildScheduleRows(originTrips, destinationTrips, transferBufferMin, walkingSpeed) {
  // Sort origin trips by departure from origin stop
  const sortedOrigin = [...originTrips].sort((a, b) => {
    return timeToSeconds(a.origin.stop_time.departure_time) -
           timeToSeconds(b.origin.stop_time.departure_time);
  });

  // Sort destination trips by departure from transfer stop
  const sortedDest = [...destinationTrips].sort((a, b) => {
    return timeToSeconds(a.transfer.stop_time.departure_time) -
           timeToSeconds(b.transfer.stop_time.departure_time);
  });

  const transferBufferSec = transferBufferMin * 60;

  // For each destination trip, find the latest feasible origin trip
  // Then group destinations by origin index
  const destByOriginIdx = new Map(); // originIdx -> [destTrip, ...]

  for (const dest of sortedDest) {
    const destTransferDep = timeToSeconds(dest.transfer.stop_time.departure_time);

    let bestOriginIdx = -1;
    for (let i = 0; i < sortedOrigin.length; i++) {
      const orig = sortedOrigin[i];
      const origTransferArr = timeToSeconds(orig.transfer.stop_time.arrival_time);

      // Calculate walk time between the two transfer stops
      const walkDist = haversineDistance(
        orig.transfer.stop_lat, orig.transfer.stop_lon,
        dest.transfer.stop_lat, dest.transfer.stop_lon
      );
      const walkTime = walkingSpeed > 0 ? walkDist / walkingSpeed : 0;

      const minDeparture = origTransferArr + transferBufferSec + walkTime;

      if (destTransferDep >= minDeparture) {
        bestOriginIdx = i;
      }
    }

    if (bestOriginIdx >= 0) {
      if (!destByOriginIdx.has(bestOriginIdx)) {
        destByOriginIdx.set(bestOriginIdx, []);
      }
      destByOriginIdx.get(bestOriginIdx).push(dest);
    }
  }

  // Interleave: for each origin trip, output the origin row, then any destination rows
  const rows = [];
  for (let i = 0; i < sortedOrigin.length; i++) {
    rows.push({ type: 'origin', data: sortedOrigin[i], index: i });
    const dests = destByOriginIdx.get(i);
    if (dests) {
      for (const d of dests) {
        rows.push({ type: 'destination', data: d, originIndex: i });
      }
    }
  }

  // Also add unmatched destination trips at the top
  const unmatchedDests = sortedDest.filter((dest) => {
    const destTransferDep = timeToSeconds(dest.transfer.stop_time.departure_time);
    // Check if it was matched to any origin
    for (const dests of destByOriginIdx.values()) {
      if (dests.includes(dest)) return false;
    }
    return true;
  });
  // Prepend unmatched destination trips
  const unmatchedRows = unmatchedDests.map(d => ({ type: 'destination-unmatched', data: d }));

  return [...unmatchedRows, ...rows];
}

function routeLabel(route) {
  if (!route) return '';
  if (route.route_short_name) return route.route_short_name;
  if (route.route_long_name) return route.route_long_name;
  return route.route_id || '';
}

function routeColor(route) {
  if (route?.route_color) return `#${route.route_color}`;
  return '#666';
}

function routeTextColor(route) {
  if (route?.route_text_color) return `#${route.route_text_color}`;
  return '#fff';
}

function RidesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from query params
  const [date, setDate] = useState(() => {
    const d = searchParams.get('date');
    if (d && /^\d{8}$/.test(d)) {
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [origin, setOrigin] = useState(() => searchParams.get('origin') || '47.6062,-122.3321');
  const [destination, setDestination] = useState(() => searchParams.get('destination') || '47.6101,-122.3420');
  const [threshold, setThreshold] = useState(() => searchParams.get('threshold') || '500');
  const [transferBuffer, setTransferBuffer] = useState(() => searchParams.get('transferBuffer') || '5');
  const [walkingSpeed, setWalkingSpeed] = useState(() => searchParams.get('walkingSpeed') || '1.4');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync inputs to query params
  const syncParams = useCallback(() => {
    const dateFormatted = date.replace(/-/g, '');
    setSearchParams({
      date: dateFormatted,
      origin,
      destination,
      threshold,
      transferBuffer,
      walkingSpeed
    }, { replace: true });
  }, [date, origin, destination, threshold, transferBuffer, walkingSpeed, setSearchParams]);

  const fetchRides = useCallback(async () => {
    const dateFormatted = date.replace(/-/g, '');
    if (!/^\d{8}$/.test(dateFormatted)) {
      setError('Invalid date');
      return;
    }
    setLoading(true);
    setError(null);
    syncParams();

    try {
      const url = `${API_BASE_URL}/twoSeatRides/on/${dateFormatted}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&threshold=${encodeURIComponent(threshold)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, origin, destination, threshold, syncParams]);

  // Auto-fetch on mount if params are present
  useEffect(() => {
    if (searchParams.get('date') && searchParams.get('origin') && searchParams.get('destination')) {
      fetchRides();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchRides();
  };

  const rows = data
    ? buildScheduleRows(
        data.originTrips || [],
        data.destinationTrips || [],
        parseFloat(transferBuffer) || 5,
        parseFloat(walkingSpeed) || 1.4
      )
    : [];

  return (
    <div className="rides-page">
      <header className="rides-header">
        <h1>Two-Seat Ride Planner</h1>
        <a href="/" className="back-link">← Back to Map</a>
      </header>

      <form className="rides-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Origin (lat,lon)</span>
            <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="47.6062,-122.3321" />
          </label>
          <label>
            <span>Destination (lat,lon)</span>
            <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="47.6101,-122.3420" />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Threshold (m)</span>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="50" step="50" />
          </label>
          <label>
            <span>Transfer Buffer (min)</span>
            <input type="number" value={transferBuffer} onChange={(e) => setTransferBuffer(e.target.value)} min="0" step="1" />
          </label>
          <label>
            <span>Walking Speed (m/s)</span>
            <input type="number" value={walkingSpeed} onChange={(e) => setWalkingSpeed(e.target.value)} min="0.1" step="0.1" />
          </label>
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="rides-error">{error}</div>}

      {data && !loading && (
        <div className="rides-summary">
          Found <strong>{data.origin_trip_count}</strong> origin trips and{' '}
          <strong>{data.destination_trip_count}</strong> destination trips
        </div>
      )}

      {rows.length > 0 && (
        <div className="rides-table-container">
          <table className="rides-table">
            <thead>
              <tr>
                <th colSpan="4" className="th-group th-origin-group">Origin Trip (First Leg)</th>
                <th colSpan="4" className="th-group th-dest-group">Destination Trip (Second Leg)</th>
              </tr>
              <tr>
                <th className="th-origin">Route</th>
                <th className="th-origin">Origin Stop</th>
                <th className="th-origin">Depart</th>
                <th className="th-origin">Transfer Stop / Arrive</th>
                <th className="th-dest">Route</th>
                <th className="th-dest">Transfer Stop / Depart</th>
                <th className="th-dest">Arrive</th>
                <th className="th-dest">Destination Stop</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.type === 'origin') {
                  const d = row.data;
                  return (
                    <tr key={`o-${idx}`} className="row-origin">
                      <td>
                        <span className="route-badge" style={{ background: routeColor(d.route), color: routeTextColor(d.route) }}>
                          {routeLabel(d.route)}
                        </span>
                      </td>
                      <td className="stop-name">{d.origin.stop_name}</td>
                      <td className="time-cell">{formatTime(timeToSeconds(d.origin.stop_time.departure_time))}</td>
                      <td className="stop-name">
                        {d.transfer.stop_name}
                        <span className="time-sub"> arr {formatTime(timeToSeconds(d.transfer.stop_time.arrival_time))}</span>
                      </td>
                      <td colSpan="4" className="empty-cell"></td>
                    </tr>
                  );
                } else {
                  const d = row.data;
                  const isUnmatched = row.type === 'destination-unmatched';
                  return (
                    <tr key={`d-${idx}`} className={`row-dest ${isUnmatched ? 'row-unmatched' : ''}`}>
                      <td colSpan="4" className="empty-cell"></td>
                      <td>
                        <span className="route-badge" style={{ background: routeColor(d.route), color: routeTextColor(d.route) }}>
                          {routeLabel(d.route)}
                        </span>
                      </td>
                      <td className="stop-name">
                        {d.transfer.stop_name}
                        <span className="time-sub"> dep {formatTime(timeToSeconds(d.transfer.stop_time.departure_time))}</span>
                      </td>
                      <td className="time-cell">{formatTime(timeToSeconds(d.destination.stop_time.arrival_time))}</td>
                      <td className="stop-name">{d.destination.stop_name}</td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RidesPage;
