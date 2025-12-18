class NotificationPermissionManager {
  constructor() {
    this.PERMISSION_CHECK_KEY = 'notificationPermissionChecked';
    this.PERMISSION_GRANTED_KEY = 'notificationPermissionGranted';
  }

  /**
   * Check if browser/device supports notifications
   */
  isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus() {
    if (!this.isNotificationSupported()) {
      console.warn('Notifications not supported on this device');
      return 'denied';
    }
    
    return Notification.permission; // 'default', 'granted', 'denied'
  }

  /**
   * Check if notifications are enabled
   */
  areNotificationsEnabled() {
    const status = this.getPermissionStatus();
    return status === 'granted';
  }

  /**
   * Request notification permission from user
   */
  async requestNotificationPermission() {
    try {
      if (!this.isNotificationSupported()) {
        console.error('Notifications not supported');
        return false;
      }

      const currentStatus = this.getPermissionStatus();

      // If already granted, return true
      if (currentStatus === 'granted') {
        console.log('✅ Notifications already granted');
        localStorage.setItem(this.PERMISSION_GRANTED_KEY, 'true');
        return true;
      }

      // If already denied, return false
      if (currentStatus === 'denied') {
        console.warn('⚠️ Notifications permanently denied by user');
        localStorage.setItem(this.PERMISSION_GRANTED_KEY, 'false');
        return false;
      }

      // Request permission (default state)
      console.log('📢 Requesting notification permission...');
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        localStorage.setItem(this.PERMISSION_GRANTED_KEY, 'true');
        return true;
      } else {
        console.warn('❌ Notification permission denied');
        localStorage.setItem(this.PERMISSION_GRANTED_KEY, 'false');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification() {
    try {
      if (!this.areNotificationsEnabled()) {
        console.log('Cannot send test notification - permission not granted');
        return false;
      }

      new Notification('✅ Notifications Enabled', {
        body: 'You will now receive job alerts.',
        icon: '/logo.svg',
        badge: '/logo.svg'
      });

      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Open app notification settings (Android/iOS)
   */
  openNotificationSettings() {
    try {
      // Detect if on Android
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

      if (isAndroid) {
        // For Android web apps, show instructions or use intent
        console.log('📱 Please open Settings > Apps > Global Appliance > Notifications and enable it');
        this.showAndroidSettingsInstructions();
      } else if (isIOS) {
        // For iOS
        console.log('📱 Please open Settings > Notifications > Global Appliance and enable it');
        this.showiOSSettingsInstructions();
      } else {
        // For web browsers
        console.log('🖥️ Please check your browser notification settings');
        this.showBrowserSettingsInstructions();
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }

  /**
   * Show Android settings instructions
   */
  showAndroidSettingsInstructions() {
    const message = `
📱 ANDROID - Enable Notifications:

1. Open your phone Settings
2. Go to: Apps > Global Appliance (or All Apps)
3. Tap: Notifications
4. Turn ON: "Allow notifications"
5. Return to this app and refresh

Or use this shortcut if available:
- Settings > Apps > Global Appliance > Notifications > Turn ON
    `;
    console.log(message);
  }

  /**
   * Show iOS settings instructions
   */
  showiOSSettingsInstructions() {
    const message = `
📱 iOS - Enable Notifications:

1. Open your phone Settings
2. Go to: Notifications
3. Find: Global Appliance
4. Turn ON: "Allow Notifications"
5. Return to this app and refresh

Or use this shortcut if available:
- Settings > Notifications > Global Appliance > Allow Notifications
    `;
    console.log(message);
  }

  /**
   * Show browser settings instructions
   */
  showBrowserSettingsInstructions() {
    const message = `
🖥️ BROWSER - Enable Notifications:

Chrome/Edge:
1. Click the lock icon next to the URL
2. Find "Notifications" and set to "Allow"
3. Refresh the page

Firefox:
1. Click the shield icon next to the URL
2. Click "Manage" and allow notifications
3. Refresh the page

Safari:
1. Preferences > Websites > Notifications
2. Find this site and set to "Allow"
3. Refresh the page
    `;
    console.log(message);
  }

  /**
   * Force check - returns true only if notifications are enabled
   */
  async forceCheckNotifications() {
    const status = this.getPermissionStatus();

    if (status === 'granted') {
      console.log('✅ Notifications enabled');
      return true;
    }

    if (status === 'denied') {
      console.warn('❌ Notifications denied - cannot request again');
      return false;
    }

    // status === 'default' - ask user
    console.log('Asking user for notification permission...');
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Store that permission check was done
   */
  markPermissionChecked() {
    localStorage.setItem(this.PERMISSION_CHECK_KEY, 'true');
  }

  /**
   * Check if permission was already checked this session
   */
  wasPermissionChecked() {
    return localStorage.getItem(this.PERMISSION_CHECK_KEY) === 'true';
  }

  /**
   * Reset permission check (for testing or new sessions)
   */
  resetPermissionCheck() {
    localStorage.removeItem(this.PERMISSION_CHECK_KEY);
    localStorage.removeItem(this.PERMISSION_GRANTED_KEY);
  }
}

const notificationPermissionManager = new NotificationPermissionManager();
export default notificationPermissionManager;
