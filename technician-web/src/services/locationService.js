/**
 * Location Service
 * Handles GPS geolocation, distance calculation, and office radius verification
 */
class LocationService {
  constructor() {
    // Office coordinates - Joramandir, Kolkata
    this.officeLocation = {
      latitude: 22.5726,   // Joramandir, Kolkata
      longitude: 88.3639,
      radius: 500 // meters
    };
  }

  /**
   * Get current GPS location
   * @returns {object} - {latitude, longitude, accuracy, timestamp} or error
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported in this browser'));
        return;
      }

      console.log('📍 Requesting GPS location...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const location = {
            latitude: parseFloat(latitude.toFixed(6)),
            longitude: parseFloat(longitude.toFixed(6)),
            accuracy: parseFloat(accuracy.toFixed(2)),
            timestamp: new Date().toISOString()
          };
          console.log('✅ GPS location obtained:', location);
          resolve(location);
        },
        (error) => {
          console.error('❌ GPS error:', error);
          let message = 'GPS error';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'GPS permission denied. Please enable location in browser settings.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Location information is unavailable.';
          } else if (error.code === error.TIMEOUT) {
            message = 'GPS request timeout. Try again.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Calculate distance between two GPS points (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} - Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(2));
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Verify if location is within office radius
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   * @returns {object} - {isWithinRadius, distance, message}
   */
  verifyOfficeRadius(latitude, longitude) {
    const distance = this.calculateDistance(
      latitude,
      longitude,
      this.officeLocation.latitude,
      this.officeLocation.longitude
    );

    const isWithinRadius = distance <= this.officeLocation.radius;
    
    return {
      isWithinRadius,
      distance,
      message: isWithinRadius
        ? `✅ You are within office radius (${distance}m away)`
        : `❌ You are ${distance}m away. Minimum radius: ${this.officeLocation.radius}m`,
      officeLocation: this.officeLocation
    };
  }

  /**
   * Update office location (admin only)
   * @param {number} latitude - Office latitude
   * @param {number} longitude - Office longitude
   * @param {number} radius - Radius in meters
   */
  setOfficeLocation(latitude, longitude, radius = 500) {
    this.officeLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseInt(radius)
    };
    console.log('📍 Office location updated:', this.officeLocation);
  }

  /**
   * Get office location
   * @returns {object} - Current office location configuration
   */
  getOfficeLocation() {
    return { ...this.officeLocation };
  }

  /**
   * Format location for display
   * @param {object} location - Location object with latitude, longitude
   * @returns {string} - Formatted location string
   */
  formatLocation(location) {
    if (!location || !location.latitude || !location.longitude) {
      return 'Location unavailable';
    }
    return `${location.latitude}, ${location.longitude}`;
  }

  /**
   * Get Google Maps link for location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {string} - Google Maps URL
   */
  getMapLink(latitude, longitude) {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
}

export default new LocationService();
