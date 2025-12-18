import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from '../firebase';
import { getDatabase, ref, set } from 'firebase/database';

class FCMService {
  constructor() {
    this.messaging = null;
    this.fcmToken = null;
    // VAPID key from Firebase Console: Project Settings > Cloud Messaging
    this.VAPID_KEY = 'BCKM_3ENAvyFEKIERpOTIvMfR2Yl5-TxiDMZUnDux8-6kIaQlbwW8f5uxt9KvECa55VUzOg6gHXQvUPI5llaiP0';
    this.isFCMSupported = this.checkFCMSupport();
    
    // Initialize FCM only if supported
    if (this.isFCMSupported) {
      this.initializeFCM().catch(err => {
        console.warn('⚠️ FCM initialization failed silently:', err.message);
        this.isFCMSupported = false;
      });
    } else {
      console.warn('⚠️ FCM not supported on this browser/device');
    }
  }

  // Check if FCM is supported
  checkFCMSupport() {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not supported');
      return false;
    }
    if (!('Notification' in window)) {
      console.warn('⚠️ Notification API not supported');
      return false;
    }
    return true;
  }

  // Initialize FCM
  async initializeFCM() {
    try {
      if (!this.isFCMSupported) {
        console.warn('⚠️ FCM not supported - skipping initialization');
        return false;
      }

      this.messaging = getMessaging(app);
      console.log('✅ FCM initialized');
      return true;
    } catch (error) {
      console.warn('⚠️ FCM initialization error:', error.message);
      this.isFCMSupported = false;
      return false;
    }
  }

  // Register service worker for FCM
  async registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker not supported');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker registered for FCM:', registration);
      return registration;
    } catch (error) {
      console.error('Error registering service worker:', error);
      return false;
    }
  }

  // Request FCM token
  async requestFCMToken() {
    try {
      if (!this.isFCMSupported || !this.messaging) {
        console.warn('⚠️ FCM not available - skipping token request');
        return null;
      }

      // Request notification permission if not already granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('⚠️ Notification permission denied');
          return null;
        }
      }

      if (Notification.permission !== 'granted') {
        console.warn('⚠️ Notification permission not granted');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: this.VAPID_KEY
      });

      if (token) {
        this.fcmToken = token;
        console.log('✅ FCM Token obtained:', token.substring(0, 30) + '...');
        console.log('📱 Full FCM Token (for admin setup):', token);
        
        // Store token in localStorage
        localStorage.setItem('fcmToken', token);
        
        return token;
      } else {
        console.warn('⚠️ No FCM token obtained - check VAPID key');
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error requesting FCM token:', error.message);
      return null;
    }
  }

  // Get stored FCM token
  getFCMToken() {
    return this.fcmToken || localStorage.getItem('fcmToken');
  }

  // Listen for foreground messages
  listenForForegroundMessages() {
    try {
      if (!this.isFCMSupported || !this.messaging) {
        console.warn('⚠️ Messaging not available - skipping foreground listener');
        return;
      }

      onMessage(this.messaging, (payload) => {
        console.log('📬 Foreground message received:', payload);

        // Show notification even when app is in foreground
        const notificationTitle = payload.notification?.title || '🚨 NEW JOB ALERT!';
        const notificationOptions = {
          body: payload.notification?.body || 'You have received a new job.',
          icon: '/logo.svg',
          badge: '/logo.svg',
          tag: 'new-job-alert',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          data: payload.data
        };

        if (Notification.permission === 'granted') {
          new Notification(notificationTitle, notificationOptions);
        }
      });

      console.log('✅ Listening for foreground messages');
    } catch (error) {
      console.warn('⚠️ Error setting up foreground message listener:', error.message);
    }
  }

  // Get FCM token and save to database
  async getFCMTokenAndSync(technicianId) {
    try {
      const token = await this.requestFCMToken();
      
      if (token && technicianId) {
        // Save token to Firebase database
        const database = getDatabase(app);
        const tokenRef = ref(database, `technicians/${technicianId}/fcmToken`);
        await set(tokenRef, {
          token: token,
          updatedAt: new Date().toISOString(),
          deviceId: this.getDeviceId()
        });

        console.log('✅ FCM token synced to database for technician:', technicianId);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error syncing FCM token:', error);
      return null;
    }
  }

  // Get or create device ID
  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Refresh FCM token
  async refreshFCMToken() {
    try {
      localStorage.removeItem('fcmToken');
      this.fcmToken = null;
      
      const newToken = await this.requestFCMToken();
      console.log('✅ FCM token refreshed:', newToken);
      
      return newToken;
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
      return null;
    }
  }

  // Check if FCM is supported
  isSupported() {
    return this.isFCMSupported;
  }
}

const fcmService = new FCMService();
export default fcmService;
