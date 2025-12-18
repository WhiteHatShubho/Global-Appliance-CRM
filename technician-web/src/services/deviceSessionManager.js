import { getDatabase, ref, set, get, update } from 'firebase/database';

class DeviceSessionManager {
  constructor() {
    this.DEVICE_ID_KEY = 'deviceId';
    this.SESSION_EXPIRY_DAYS = 30;
  }

  // Get or create a unique device ID
  getDeviceId() {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate a unique device ID
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      console.log('New device ID created:', deviceId);
    }
    
    return deviceId;
  }

  // Create or update session in Firebase for a user
  async createOrUpdateSession(userId, userName, email, userType = 'technician') {
    try {
      const database = getDatabase();
      const deviceId = this.getDeviceId();
      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRY_DAYS);

      const sessionData = {
        userId,
        userName,
        email,
        userType,
        deviceId,
        loginTime: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isActive: true
      };

      // Store session in Firebase: sessions/{userId}
      const sessionRef = ref(database, `sessions/${userId}`);
      await set(sessionRef, sessionData);

      console.log('Session created in Firebase for user:', userId);
      return sessionData;
    } catch (error) {
      console.error('Error creating session in Firebase:', error);
      throw error;
    }
  }

  // Check if user already has an active session on a different device
  async checkActiveSessionOnDifferentDevice(userId) {
    try {
      const database = getDatabase();
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);

      if (!snapshot.exists()) {
        // No existing session
        console.log('✅ No existing session found');
        return { hasActiveSession: false, sessionData: null };
      }

      const sessionData = snapshot.val();
      const currentDeviceId = this.getDeviceId();
      
      console.log('📱 Current device ID:', currentDeviceId);
      console.log('📱 Firebase session device ID:', sessionData.deviceId);
      console.log('📱 Session active status:', sessionData.isActive);
      
      // If deviceId is null or missing, session was cleared
      if (!sessionData.deviceId || sessionData.deviceId === null) {
        console.log('✅ Session was cleared (no device ID)');
        return { hasActiveSession: false, sessionData };
      }
      
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();

      // Check if session is active and not expired
      if (sessionData.isActive && now < expiresAt) {
        // Check if it's on a different device
        if (sessionData.deviceId !== currentDeviceId) {
          console.log('❌ User already logged in on different device:', sessionData.deviceId);
          return { hasActiveSession: true, sessionData };
        } else {
          console.log('✅ Same device, allowing login');
          return { hasActiveSession: false, sessionData };
        }
      } else {
        console.log('✅ Session expired or inactive');
      }

      // Session expired or same device
      return { hasActiveSession: false, sessionData };
    } catch (error) {
      console.error('Error checking active session:', error);
      throw error;
    }
  }

  // Get current session from Firebase
  async getActiveSession(userId) {
    try {
      const database = getDatabase();
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);

      if (!snapshot.exists()) {
        return null;
      }

      const sessionData = snapshot.val();
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();
      const currentDeviceId = this.getDeviceId();

      // Check if session is valid
      if (!sessionData.isActive || now > expiresAt) {
        console.log('Session expired or inactive');
        return null;
      }

      // Check if this is the same device
      if (sessionData.deviceId !== currentDeviceId) {
        console.log('Session exists but on different device');
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  // Clear session (logout)
  async clearSession(userId) {
    try {
      const database = getDatabase();
      const sessionRef = ref(database, `sessions/${userId}`);
      
      // Completely remove the session from Firebase
      await set(sessionRef, {
        isActive: false,
        logoutTime: new Date().toISOString(),
        userId: userId,
        deviceId: null,
        expiresAt: new Date().toISOString()
      });

      console.log('✅ Session cleared for user:', userId);
    } catch (error) {
      console.error('Error clearing session:', error);
      // Continue anyway - don't throw
    }
  }

  // Check if a session is still valid
  async isSessionValid(userId) {
    const session = await this.getActiveSession(userId);
    return session !== null;
  }

  // Get remaining days for session
  async getRemainingDays(userId) {
    try {
      const database = getDatabase();
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);

      if (!snapshot.exists()) {
        return 0;
      }

      const sessionData = snapshot.val();
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();
      const diffTime = expiresAt - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch (error) {
      console.error('Error getting remaining days:', error);
      return 0;
    }
  }
}

const deviceSessionManager = new DeviceSessionManager();
export default deviceSessionManager;
