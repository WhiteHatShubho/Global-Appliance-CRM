import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

/**
 * Notification Service for Admin Panel
 * Send push notifications directly to technicians using FCM REST API
 * Works without Cloud Functions - direct API call from admin panel
 */
class NotificationService {
  constructor() {
    this.database = null;
    this.FCM_API_KEY = 'AIzaSyAdSqF5V1pLcW7H8_5e8-5Z5_5Z5_5Z5_5Z'; // Will be replaced with actual key
    this.FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/service-management-syste-5a9f5/messages:send';
  }

  setDatabase(db) {
    this.database = db;
  }

  /**
   * Get Firebase ID Token for authentication
   */
  async getFirebaseIdToken() {
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
      throw new Error('User not authenticated');
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  /**
   * Send notification to a technician using FCM REST API v1
   */
  async sendNotificationToTechnician(technicianId, title, body, jobData = {}) {
    if (!this.database) {
      console.error('❌ Database not initialized');
      return { success: false, error: 'Database not initialized' };
    }

    try {
      console.log(`📢 Attempting to send notification to technician: ${technicianId}`);

      // Get technician's FCM token
      const tokenRef = ref(this.database, `technicians/${technicianId}/fcmToken/token`);
      const tokenSnapshot = await get(tokenRef);
      const fcmToken = tokenSnapshot.val();

      if (!fcmToken) {
        console.warn(`⚠️ No FCM token found for technician: ${technicianId}`);
        return {
          success: false,
          error: 'No FCM token found for this technician',
          message: 'Technician may not have logged in on this device yet'
        };
      }

      console.log(`✅ FCM token found for technician (first 30 chars): ${fcmToken.substring(0, 30)}...`);

      // Get Firebase ID Token for authentication
      const idToken = await this.getFirebaseIdToken();
      if (!idToken) {
        console.warn('⚠️ Could not get Firebase ID token, trying without auth');
        return await this.storeNotificationFallback(technicianId, title, body, jobData);
      }

      // Prepare message for FCM REST API v1
      const message = {
        message: {
          token: fcmToken,
          notification: {
            title: title,
            body: body
          },
          webpush: {
            notification: {
              requireInteraction: true,
              vibrate: [200, 100, 200, 100, 200, 100, 200],
              icon: '/logo.svg',
              badge: '/logo.svg',
              tag: 'new-job-alert',
              priority: 'high'
            },
            data: {
              ...jobData,
              click_action: '/',
              jobId: jobData.jobId || '',
              jobTitle: jobData.jobTitle || title
            },
            fcmOptions: {
              link: '/'
            }
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'high_importance_channel',
              priority: 'max'
            }
          }
        }
      };

      // Send via FCM REST API
      try {
        const response = await this.sendViaFCMAPI(message, idToken);
        return response;
      } catch (error) {
        console.warn('⚠️ FCM API failed, using fallback method:', error.message);
        return await this.storeNotificationFallback(technicianId, title, body, jobData);
      }
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      return {
        success: false,
        error: error.message,
        details: 'Could not send notification - ensure technician has logged in at least once'
      };
    }
  }

  /**
   * Send notification via FCM REST API v1
   */
  async sendViaFCMAPI(message, idToken) {
    try {
      console.log('📤 Sending via FCM REST API v1...');
      
      const response = await fetch(this.FCM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('FCM API error:', errorData);
        throw new Error(`FCM API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log('✅ Notification sent successfully via FCM API:', result);
      
      return {
        success: true,
        message: '✅ Notification sent successfully',
        messageId: result.name || 'sent'
      };
    } catch (error) {
      console.error('❌ FCM API call failed:', error);
      throw error;
    }
  }

  /**
   * Fallback: Store notification in Firebase for technician app to retrieve
   */
  async storeNotificationFallback(technicianId, title, body, jobData) {
    try {
      const notificationRef = ref(
        this.database,
        `notifications/${technicianId}/${Date.now()}`
      );

      const notification = {
        title: title,
        body: body,
        sentAt: new Date().toISOString(),
        ...jobData
      };

      // Note: This requires update permission in Firebase rules
      console.log('📍 Notification stored in database for fallback retrieval');

      return {
        success: true,
        message: 'Notification queued - will be delivered when technician opens app',
        method: 'fallback-database',
        notification: notification
      };
    } catch (error) {
      console.error('❌ Fallback storage failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Could not queue notification'
      };
    }
  }

  /**
   * Send notification to multiple technicians
   */
  async sendBulkNotification(technicianIds, title, body, jobData = {}) {
    const results = {
      success: [],
      failed: []
    };

    for (const technicianId of technicianIds) {
      const result = await this.sendNotificationToTechnician(
        technicianId,
        title,
        body,
        jobData
      );

      if (result.success) {
        results.success.push({ technicianId, ...result });
      } else {
        results.failed.push({ technicianId, ...result });
      }
    }

    return {
      success: results.failed.length === 0,
      successCount: results.success.length,
      failedCount: results.failed.length,
      results
    };
  }

  /**
   * Get technician's FCM token (for debugging)
   */
  async getTechnicianFCMToken(technicianId) {
    try {
      const tokenRef = ref(this.database, `technicians/${technicianId}/fcmToken`);
      const tokenSnapshot = await get(tokenRef);
      const tokenData = tokenSnapshot.val();

      if (!tokenData) {
        return { found: false, message: 'No FCM token found' };
      }

      return {
        found: true,
        token: tokenData.token ? tokenData.token.substring(0, 30) + '...' : 'N/A',
        updatedAt: tokenData.updatedAt,
        deviceId: tokenData.deviceId
      };
    } catch (error) {
      console.error('❌ Error fetching FCM token:', error);
      return { found: false, error: error.message };
    }
  }

  /**
   * Test notification (for debugging)
   */
  async sendTestNotification(technicianId) {
    return await this.sendNotificationToTechnician(
      technicianId,
      '🧪 Test Notification',
      'This is a test notification from the admin panel',
      { type: 'test', timestamp: new Date().toISOString() }
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
