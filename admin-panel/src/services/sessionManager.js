class SessionManager {
  constructor() {
    this.SESSION_KEY = 'userSession';
    this.SESSION_EXPIRY_DAYS = 30;
  }

  // Check if user has a valid session
  hasValidSession() {
    const session = this.getSession();
    if (!session) {
      return false;
    }

    // Check if session has expired
    const expiryDate = new Date(session.expiryDate);
    const now = new Date();

    if (now > expiryDate) {
      this.clearSession();
      return false;
    }

    return true;
  }

  // Create a new session
  createSession(userId, userName, email) {
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.SESSION_EXPIRY_DAYS);

    const session = {
      userId,
      userName,
      email,
      createdAt: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      deviceId: this.getOrCreateDeviceId()
    };

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  }

  // Get current session
  getSession() {
    const sessionStr = localStorage.getItem(this.SESSION_KEY);
    if (!sessionStr) {
      return null;
    }

    try {
      return JSON.parse(sessionStr);
    } catch (error) {
      console.error('Error parsing session:', error);
      return null;
    }
  }

  // Get or create device ID
  getOrCreateDeviceId() {
    const DEVICE_ID_KEY = 'deviceId';
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate a unique device ID
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  }

  // Clear session
  clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
  }

  // Get remaining days
  getRemainingDays() {
    const session = this.getSession();
    if (!session) {
      return 0;
    }

    const expiryDate = new Date(session.expiryDate);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  // Get session info
  getSessionInfo() {
    const session = this.getSession();
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      userName: session.userName,
      email: session.email,
      createdAt: new Date(session.createdAt),
      expiryDate: new Date(session.expiryDate),
      remainingDays: this.getRemainingDays(),
      deviceId: session.deviceId
    };
  }
}

const sessionManager = new SessionManager();
export default sessionManager;
