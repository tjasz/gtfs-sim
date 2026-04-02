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

function RouteBadge({ route }) {
  return (
    <span className="route-badge" style={{ background: routeColor(route), color: routeTextColor(route) }}>
      {routeLabel(route)}
    </span>
  );
}

function bestArrivalTime(ride) {
  let best = Infinity;
  for (const transfer of ride.transfers) {
    for (const cont of transfer.continuations) {
      const t = timeToSeconds(cont.destination.stop_time.arrival_time);
      if (t < best) best = t;
    }
  }
  return best === Infinity ? null : best;
}

function RideCard({ ride }) {
  const [expanded, setExpanded] = useState(false);
  const bestArr = bestArrivalTime(ride);

  return (
    <div className={`ride-card ${expanded ? 'ride-card-expanded' : ''}`}>
      <button
        type="button"
        className="ride-first-leg"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="leg-header leg-header-origin">
          <span className="collapse-indicator">{expanded ? '\u25BC' : '\u25B6'}</span>
          First Leg
        </div>
        <div className="leg-details">
          <RouteBadge route={ride.route} />
          <span className="leg-headsign">{ride.trip.trip_headsign}</span>
          <span className="leg-stops">
            <span className="stop-name">{ride.origin.stop_name}</span>
            <span className="time-cell">{formatTime(timeToSeconds(ride.origin.stop_time.departure_time))}</span>
            <span className="leg-arrow">→</span>
            {bestArr !== null && (
              <span className="best-arrival">arrives {formatTime(bestArr)}</span>
            )}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="ride-transfers">
          {ride.transfers.map((transfer, ti) => {
            const sortedContinuations = [...transfer.continuations].sort((a, b) =>
              timeToSeconds(a.transfer_stop.stop_time.departure_time) -
              timeToSeconds(b.transfer_stop.stop_time.departure_time)
            );
            return (
              <div key={ti} className="transfer-group">
                <div className="transfer-stop-header">
                  <span className="transfer-label">Transfer at</span>
                  <span className="stop-name">{transfer.transfer_stop.stop_name}</span>
                  <span className="time-sub">arr {formatTime(timeToSeconds(transfer.transfer_stop.stop_time.arrival_time))}</span>
                </div>
                <table className="continuations-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Board At</th>
                      <th>Depart</th>
                      <th>Destination</th>
                      <th>Arrive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedContinuations.map((cont, ci) => (
                      <tr key={ci}>
                        <td><RouteBadge route={cont.route} /></td>
                        <td className="stop-name">{cont.transfer_stop.stop_name}</td>
                        <td className="time-cell">{formatTime(timeToSeconds(cont.transfer_stop.stop_time.departure_time))}</td>
                        <td className="stop-name">{cont.destination.stop_name}</td>
                        <td className="time-cell">{formatTime(timeToSeconds(cont.destination.stop_time.arrival_time))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
      threshold
    }, { replace: true });
  }, [date, origin, destination, threshold, setSearchParams]);

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

  const sortedRides = data
    ? [...(data.rides || [])].sort((a, b) =>
        timeToSeconds(a.origin.stop_time.departure_time) -
        timeToSeconds(b.origin.stop_time.departure_time)
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
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="rides-error">{error}</div>}

      {data && !loading && (
        <div className="rides-summary">
          Found <strong>{data.ride_count}</strong> origin trips with transfers
        </div>
      )}

      {sortedRides.length > 0 && (
        <div className="rides-list">
          {sortedRides.map((ride, ri) => (
            <RideCard key={ri} ride={ride} />
          ))}
        </div>
      )}
    </div>
  );
}

export default RidesPage;
