import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import locationTrackingService from '../services/locationTrackingService';

const StaffLocationTracker = () => {
  const [locations, setLocations] = useState({});
  const [selectedTech, setSelectedTech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchRadius, setSearchRadius] = useState(5);
  const [centerLat, setCenterLat] = useState(null);
  const [centerLon, setCenterLon] = useState(null);
  const [techniciansInRadius, setTechniciansInRadius] = useState([]);

  useEffect(() => {
    fetchLocations();
    const unsubscribe = setupRealtimeListener();
    return () => {
      unsubscribe?.();
      locationTrackingService.stopAllTracking();
    };
  }, []);

  /**
   * Fetch all technician locations
   */
  const fetchLocations = async () => {
    try {
      setLoading(true);
      const allLocations = await locationTrackingService.getAllTechnicianLocations();
      setLocations(allLocations || {});
      setError('');
    } catch (err) {
      console.error('Fetch locations error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Setup real-time location listener
   */
  const setupRealtimeListener = () => {
    try {
      const db = getDatabase();
      const locationsRef = ref(db, 'technician_locations');
      
      const unsubscribe = onValue(locationsRef, (snapshot) => {
        if (snapshot.exists()) {
          setLocations(snapshot.val());
        }
      }, (err) => {
        console.error('Real-time listener error:', err);
        setError('Failed to listen for location updates');
      });

      return unsubscribe;
    } catch (err) {
      console.error('Setup listener error:', err);
    }
  };

  /**
   * Get current device location
   */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenterLat(position.coords.latitude);
        setCenterLon(position.coords.longitude);
        setError('');
      },
      (err) => {
        setError('Failed to get current location: ' + err.message);
      }
    );
  };

  /**
   * Find technicians within radius
   */
  const findTechniciansNearby = async () => {
    if (!centerLat || !centerLon) {
      setError('Please get current location first');
      return;
    }

    try {
      setLoading(true);
      const nearby = await locationTrackingService.getTechniciansWithinRadius(
        centerLat,
        centerLon,
        searchRadius
      );
      setTechniciansInRadius(nearby);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format timestamp to readable date
   */
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Format coordinates
   */
  const formatCoords = (lat, lon) => {
    return `${lat?.toFixed(4)}, ${lon?.toFixed(4)}`;
  };

  if (loading && Object.keys(locations).length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>📍 Loading staff locations...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#0066ff', marginBottom: '20px' }}>📍 Staff Location Tracker</h1>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Nearby Search Section */}
      <div style={{
        background: '#f0f4ff',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '2px solid #0066ff'
      }}>
        <h3 style={{ color: '#0066ff', margin: '0 0 15px 0' }}>🔍 Find Staff Nearby</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <button
            onClick={getCurrentLocation}
            style={{
              padding: '10px 15px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            📍 Get My Location
          </button>
          
          {centerLat && (
            <div style={{ padding: '10px', background: 'white', borderRadius: '4px' }}>
              <strong>My Location:</strong> {formatCoords(centerLat, centerLon)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>Radius (km):</label>
            <input
              type="number"
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
              min="0.5"
              max="50"
              step="0.5"
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                width: '80px'
              }}
            />
          </div>

          <button
            onClick={findTechniciansNearby}
            disabled={!centerLat || !centerLon}
            style={{
              padding: '10px 15px',
              background: centerLat && centerLon ? '#0066ff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: centerLat && centerLon ? 'pointer' : 'not-allowed',
              fontWeight: '600'
            }}
          >
            🔎 Search
          </button>
        </div>

        {techniciansInRadius.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>
              ✅ Found {techniciansInRadius.length} staff member(s) within {searchRadius} km
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '10px'
            }}>
              {techniciansInRadius.map((tech) => (
                <div key={tech.technicianId} style={{
                  background: 'white',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #10b981'
                }}>
                  <strong>{tech.technicianId}</strong><br/>
                  📍 {formatCoords(tech.latitude, tech.longitude)}<br/>
                  📏 <strong style={{ color: '#10b981' }}>{tech.distanceKm} km away</strong><br/>
                  🎯 Accuracy: {tech.accuracy?.toFixed(1) || 'N/A'} m
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All Staff Locations */}
      <div>
        <h3 style={{ color: '#0066ff', marginBottom: '15px' }}>👥 All Staff Locations</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '15px'
        }}>
          {Object.entries(locations).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>
              No staff locations available yet. Staff members need to enable location sharing.
            </div>
          ) : (
            Object.entries(locations).map(([techId, location]) => (
              <div
                key={techId}
                onClick={() => setSelectedTech(selectedTech === techId ? null : techId)}
                style={{
                  background: selectedTech === techId ? '#e3f2fd' : 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  border: selectedTech === techId ? '2px solid #0066ff' : '1px solid #ddd',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ fontSize: '1.1rem', color: '#0066ff' }}>👤 {techId}</strong>
                  <span style={{
                    marginLeft: '10px',
                    padding: '4px 8px',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.85rem'
                  }}>
                    🟢 Online
                  </span>
                </div>

                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  <div>📍 <strong>Coordinates:</strong></div>
                  <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                    {formatCoords(location.latitude, location.longitude)}
                  </div>

                  <div>⏱️ <strong>Last Update:</strong></div>
                  <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                    {formatTime(location.timestamp)}
                  </div>

                  {location.accuracy && (
                    <>
                      <div>🎯 <strong>Accuracy:</strong></div>
                      <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                        {location.accuracy.toFixed(1)} meters
                      </div>
                    </>
                  )}

                  {location.speed !== null && location.speed !== undefined && (
                    <>
                      <div>💨 <strong>Speed:</strong></div>
                      <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                        {(location.speed * 3.6).toFixed(1)} km/h
                      </div>
                    </>
                  )}

                  {selectedTech === techId && (
                    <>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                        <div>🌍 <strong>Google Maps:</strong></div>
                        <a
                          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginLeft: '20px',
                            display: 'inline-block',
                            color: '#0066ff',
                            textDecoration: 'none',
                            marginBottom: '8px'
                          }}
                        >
                          📌 Open in Maps
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffLocationTracker;
