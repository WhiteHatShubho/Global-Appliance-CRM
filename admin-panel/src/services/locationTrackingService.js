import { getDatabase, ref, set, update, query, orderByChild, get } from 'firebase/database';

class LocationTrackingService {
  constructor() {
    this.locationWatchers = {};
    this.db = getDatabase();
  }

  /**
   * Start tracking technician location in real-time
   * @param {string} technicianId - Technician ID
   * @returns {Promise<object>} - Geolocation watch ID
   */
  async startLocationTracking(technicianId) {
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported on this device');
      }

      // Request location permission
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          this._updateLocationInFirebase(technicianId, position.coords);
        },
        (error) => {
          console.error('Location tracking error:', error);
          this._handleLocationError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );

      this.locationWatchers[technicianId] = watchId;
      console.log('✅ Location tracking started for:', technicianId);
      return watchId;
    } catch (err) {
      console.error('Start location tracking error:', err);
      throw new Error(err.message || 'Failed to start location tracking');
    }
  }

  /**
   * Stop tracking technician location
   * @param {string} technicianId - Technician ID
   */
  stopLocationTracking(technicianId) {
    try {
      const watchId = this.locationWatchers[technicianId];
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
        delete this.locationWatchers[technicianId];
        console.log('🛑 Location tracking stopped for:', technicianId);
      }
    } catch (err) {
      console.error('Stop location tracking error:', err);
    }
  }

  /**
   * Update location in Firebase
   * @private
   */
  async _updateLocationInFirebase(technicianId, coords) {
    try {
      const locationRef = ref(this.db, `technician_locations/${technicianId}`);
      await set(locationRef, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude || null,
        heading: coords.heading || null,
        speed: coords.speed || null,
        timestamp: new Date().toIso8601String(),
        updatedAt: Date.now()
      });
      console.log('📍 Location updated for:', technicianId);
    } catch (err) {
      console.error('Firebase location update error:', err);
    }
  }

  /**
   * Get current location of a technician
   * @param {string} technicianId - Technician ID
   * @returns {Promise<object>} - Location data
   */
  async getTechnicianLocation(technicianId) {
    try {
      const locationRef = ref(this.db, `technician_locations/${technicianId}`);
      const snapshot = await get(locationRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (err) {
      console.error('Get location error:', err);
      throw new Error('Failed to fetch technician location');
    }
  }

  /**
   * Get all technician locations
   * @returns {Promise<object>} - All technician locations
   */
  async getAllTechnicianLocations() {
    try {
      const locationsRef = ref(this.db, 'technician_locations');
      const snapshot = await get(locationsRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return {};
    } catch (err) {
      console.error('Get all locations error:', err);
      throw new Error('Failed to fetch technician locations');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} - Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get technician location history
   * @param {string} technicianId - Technician ID
   * @returns {Promise<array>} - Location history
   */
  async getLocationHistory(technicianId) {
    try {
      const historyRef = ref(this.db, `location_history/${technicianId}`);
      const snapshot = await get(historyRef);
      
      if (snapshot.exists()) {
        return Object.values(snapshot.val());
      }
      return [];
    } catch (err) {
      console.error('Get location history error:', err);
      throw new Error('Failed to fetch location history');
    }
  }

  /**
   * Archive location history (daily snapshot)
   * @param {string} technicianId - Technician ID
   */
  async archiveLocationHistory(technicianId) {
    try {
      const currentLocation = await this.getTechnicianLocation(technicianId);
      if (currentLocation) {
        const historyRef = ref(
          this.db,
          `location_history/${technicianId}/${Date.now()}`
        );
        await set(historyRef, {
          ...currentLocation,
          archivedAt: new Date().toIso8601String()
        });
        console.log('📦 Location history archived for:', technicianId);
      }
    } catch (err) {
      console.error('Archive location history error:', err);
    }
  }

  /**
   * Handle location errors
   * @private
   */
  _handleLocationError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location permission denied');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable');
        break;
      case error.TIMEOUT:
        console.error('Location request timeout');
        break;
      default:
        console.error('Unknown location error:', error);
    }
  }

  /**
   * Get technicians within radius of a point
   * @param {number} centerLat - Center latitude
   * @param {number} centerLon - Center longitude
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Promise<array>} - Technicians within radius
   */
  async getTechniciansWithinRadius(centerLat, centerLon, radiusKm) {
    try {
      const allLocations = await this.getAllTechnicianLocations();
      const techniciansInRadius = [];

      for (const [techId, location] of Object.entries(allLocations)) {
        if (location.latitude && location.longitude) {
          const distance = this.calculateDistance(
            centerLat,
            centerLon,
            location.latitude,
            location.longitude
          );

          if (distance <= radiusKm) {
            techniciansInRadius.push({
              technicianId: techId,
              ...location,
              distanceKm: distance.toFixed(2)
            });
          }
        }
      }

      return techniciansInRadius.sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (err) {
      console.error('Get technicians within radius error:', err);
      throw new Error('Failed to fetch technicians within radius');
    }
  }

  /**
   * Cleanup all watchers
   */
  stopAllTracking() {
    for (const [technicianId, watchId] of Object.entries(this.locationWatchers)) {
      navigator.geolocation.clearWatch(watchId);
    }
    this.locationWatchers = {};
    console.log('🛑 All location tracking stopped');
  }
}

export default new LocationTrackingService();
