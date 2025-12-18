/**
 * App Permission Manager
 * Handles all app permissions including camera, storage, location, and notifications
 * Forces permission requests on first app launch
 */

class AppPermissionManager {
  constructor() {
    this.permissionsGranted = false;
    this.permissionStatus = {
      camera: 'unknown',
      notifications: 'unknown',
      location: 'unknown'
    };
  }

  /**
   * Check if all required permissions are granted
   */
  async checkAllPermissions() {
    const results = {
      camera: await this.checkCameraPermission(),
      notifications: await this.checkNotificationPermission(),
      location: await this.checkLocationPermission()
    };
    
    this.permissionStatus = results;
    this.permissionsGranted = results.camera === 'granted';
    
    return results;
  }

  /**
   * Request all required permissions at once
   * Called on app first launch
   */
  async requestAllPermissions() {
    console.log('📋 Requesting all app permissions...');
    
    const results = {
      camera: false,
      notifications: false,
      location: false
    };

    // Request camera permission first (most critical)
    try {
      results.camera = await this.requestCameraPermission();
      console.log('📸 Camera permission:', results.camera ? 'GRANTED' : 'DENIED');
    } catch (error) {
      console.error('❌ Camera permission error:', error);
    }

    // Request notification permission
    try {
      results.notifications = await this.requestNotificationPermission();
      console.log('🔔 Notification permission:', results.notifications ? 'GRANTED' : 'DENIED');
    } catch (error) {
      console.error('❌ Notification permission error:', error);
    }

    // Request location permission
    try {
      results.location = await this.requestLocationPermission();
      console.log('📍 Location permission:', results.location ? 'GRANTED' : 'DENIED');
    } catch (error) {
      console.error('❌ Location permission error:', error);
    }

    // Mark as checked
    localStorage.setItem('permissionsRequested', 'true');
    
    return results;
  }

  /**
   * Check if camera permission is granted
   */
  async checkCameraPermission() {
    try {
      // Try to query permission status
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state;
      }
      
      // Fallback: try to access camera briefly
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'denied';
      }
      return 'prompt';
    }
  }

  /**
   * Request camera permission
   */
  async requestCameraPermission() {
    try {
      console.log('📸 Requesting camera permission...');
      
      // Request camera access - this will trigger the permission popup
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Camera permission granted');
      localStorage.setItem('cameraPermissionGranted', 'true');
      return true;
    } catch (error) {
      console.error('❌ Camera permission denied:', error.message);
      localStorage.setItem('cameraPermissionGranted', 'false');
      return false;
    }
  }

  /**
   * Check if notification permission is granted
   */
  async checkNotificationPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('❌ Notification permission error:', error);
      return false;
    }
  }

  /**
   * Check if location permission is granted
   */
  async checkLocationPermission() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
      }
      return 'prompt';
    } catch (error) {
      return 'prompt';
    }
  }

  /**
   * Request location permission
   */
  async requestLocationPermission() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('⚠️ Geolocation not supported');
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          console.log('✅ Location permission granted');
          resolve(true);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            console.error('❌ Location permission denied');
          }
          resolve(false);
        },
        { timeout: 10000 }
      );
    });
  }

  /**
   * Check if this is first app launch (permissions not yet requested)
   */
  isFirstLaunch() {
    return localStorage.getItem('permissionsRequested') !== 'true';
  }

  /**
   * Check if camera permission was previously granted
   */
  isCameraPermissionGranted() {
    return localStorage.getItem('cameraPermissionGranted') === 'true';
  }

  /**
   * Verify camera permission before use
   * Returns true if permission is granted, false otherwise
   */
  async verifyCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('❌ Camera access denied:', error.message);
      return false;
    }
  }

  /**
   * Open app settings or request specific permission
   * @param {string} permissionType - 'camera', 'notification', or 'location'
   */
  async openAppSettings(permissionType = 'camera') {
    try {
      // First, try to request the specific permission directly via system dialog
      console.log(`💻 Requesting ${permissionType} permission directly...`);
      
      let granted = false;
      
      if (permissionType === 'camera') {
        granted = await this.requestCameraPermission();
      } else if (permissionType === 'notification') {
        granted = await this.requestNotificationPermission();
      } else if (permissionType === 'location') {
        granted = await this.requestLocationPermission();
      }
      
      if (granted) {
        console.log(`✅ ${permissionType} permission granted!`);
        return true;
      }
      
      console.log(`⚠️ ${permissionType} permission denied`);
      return false;
    } catch (error) {
      console.error(`⚠️ Error requesting ${permissionType}:`, error);
      return false;
    }
  }

  /**
   * Get human-readable permission status
   */
  getPermissionStatusMessage() {
    const status = this.permissionStatus;
    const messages = [];
    
    if (status.camera !== 'granted') {
      messages.push('Camera: Required for photo capture');
    }
    if (status.notifications !== 'granted') {
      messages.push('Notifications: Required for job alerts');
    }
    if (status.location !== 'granted') {
      messages.push('Location: Required for attendance');
    }
    
    return messages;
  }
}

const appPermissionManager = new AppPermissionManager();
export default appPermissionManager;
