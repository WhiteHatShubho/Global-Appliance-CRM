import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { getDatabase, ref, get, set } from 'firebase/database';
import sessionManager from './sessionManager';

/**
 * Google Authentication Service
 * Allows technicians to login with Gmail without password
 */
class GoogleAuthService {
  constructor() {
    this.auth = null;
    this.provider = null;
  }

  /**
   * Initialize Google Auth provider
   */
  initialize(firebaseApp) {
    try {
      this.auth = getAuth(firebaseApp);
      this.provider = new GoogleAuthProvider();
      
      // Request specific scopes
      this.provider.addScope('profile');
      this.provider.addScope('email');
      
      console.log('✅ Google Auth provider initialized');
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
    }
  }

  /**
   * Check if technician exists by email in Firebase
   */
  async technicianExists(email) {
    try {
      const db = getDatabase();
      const techniciansRef = ref(db, 'technicians');
      const snapshot = await get(techniciansRef);

      if (!snapshot.exists()) {
        return null;
      }

      const technicians = snapshot.val();
      for (const [techId, techData] of Object.entries(technicians)) {
        if (techData.email === email) {
          return { id: techId, ...techData };
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking technician:', error);
      return null;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      if (!this.auth || !this.provider) {
        throw new Error('Google Auth not initialized');
      }

      console.log('🔵 Attempting Google Sign-In...');

      let userCredential = null;

      // Try popup first (works on most devices)
      try {
        userCredential = await signInWithPopup(this.auth, this.provider);
      } catch (popupError) {
        // If popup fails (e.g., on mobile Safari), try redirect
        if (popupError.code === 'auth/popup-blocked') {
          console.log('⚠️ Popup blocked, trying redirect method...');
          await signInWithRedirect(this.auth, this.provider);
          // Get redirect result
          userCredential = await getRedirectResult(this.auth);
        } else {
          throw popupError;
        }
      }

      if (!userCredential) {
        throw new Error('Google Sign-In returned no credentials');
      }

      const user = userCredential.user;
      console.log('✅ Google Sign-In successful:', user.email);

      // Check if technician exists in database
      const technician = await this.technicianExists(user.email);

      if (!technician) {
        return {
          success: false,
          message: `❌ Email "${user.email}" is not registered as a technician. Please contact your administrator to add your email.`,
          userEmail: user.email,
          firebaseUser: user
        };
      }

      console.log('✅ Technician found:', technician.name);

      // Create session
      const session = sessionManager.createSession(
        technician.id,
        technician.name,
        user.email,
        technician.phone
      );

      // Auto-save token with 30-day expiry
      const token = `google_${user.uid}_${Date.now()}`;
      const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem('auth', JSON.stringify({ 
        token, 
        expiry, 
        email: user.email,
        authMethod: 'google',
        googleUid: user.uid
      }));

      // Update technician's last login and Google UID
      try {
        const db = getDatabase();
        const techRef = ref(db, `technicians/${technician.id}`);
        const updateData = {
          lastLogin: new Date().toISOString(),
          googleId: user.uid
        };
        await set(techRef, { ...technician, ...updateData });
        console.log('✅ Updated technician with Google UID and last login');
      } catch (updateError) {
        console.warn('⚠️ Could not update technician Google UID:', updateError);
        // Don't fail login if update fails
      }

      return {
        success: true,
        message: `✅ Welcome, ${technician.name}!`,
        technician,
        firebaseUser: user
      };
    } catch (error) {
      console.error('❌ Google Sign-In error:', error);
      
      let errorMessage = 'Google Sign-In failed. Please try again.';
      
      if (error.code === 'auth/popup-blocked') {
        errorMessage = '❌ Pop-up blocked. Please enable pop-ups for this site.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = '⚠️ Sign-in cancelled.';
      } else if (error.code === 'auth/operation-not-supported-in-this-environment') {
        errorMessage = '❌ Google Sign-In not supported in this environment. Please use email/password login.';
      }

      return {
        success: false,
        message: errorMessage,
        error
      };
    }
  }

  /**
   * Sign out from Google
   */
  async signOut() {
    try {
      if (this.auth) {
        await this.auth.signOut();
        localStorage.removeItem('auth');
        console.log('✅ Signed out from Google');
        return { success: true };
      }
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error };
    }
  }

  /**
   * Get current Google user
   */
  getCurrentUser() {
    return this.auth?.currentUser || null;
  }

  /**
   * Check if user is authenticated via Google
   */
  isGoogleAuthenticated() {
    return this.getCurrentUser() !== null;
  }
}

export default new GoogleAuthService();
