/**
 * Biometric Authentication Service
 * Client-side only - No server verification needed
 * Stores credentials locally on device
 * Similar to Paytm: Email/Password first time → Face/Fingerprint after that
 */

class BiometricAuthService {
  constructor() {
    this.CREDENTIAL_KEY = 'biometric_credential';
    this.REGISTERED_KEY = 'biometric_registered';
    this.USER_KEY = 'biometric_user';
  }

  /**
   * Check if device supports biometric authentication
   */
  async isSupported() {
    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        console.log('❌ WebAuthn not supported');
        return false;
      }

      // Check if platform authenticator is available
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      console.log('✅ Biometric support:', available);
      return available;
    } catch (error) {
      console.error('Biometric support check error:', error);
      return false;
    }
  }

  /**
   * Check if biometric is registered for this user
   */
  isRegistered(userId) {
    const registered = localStorage.getItem(this.REGISTERED_KEY);
    const storedUserId = localStorage.getItem(this.USER_KEY);
    return registered === 'true' && storedUserId === userId;
  }

  /**
   * Register biometric (Face/Fingerprint) after first login
   * Called after successful email/password login
   */
  async registerBiometric(userId, userName, userEmail) {
    try {
      console.log('📸 Starting biometric registration...');

      const publicKey = {
        challenge: new Uint8Array(32),
        rp: {
          name: 'Global Appliance Tech',
          id: window.location.hostname
        },
        user: {
          id: new Uint8Array(
            userId.split('').map(ch => ch.charCodeAt(0))
          ),
          name: userEmail,
          displayName: userName
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
          authenticatorAttachment: 'platform' // Face/Fingerprint only
        },
        timeout: 60000,
        attestation: 'none'
      };

      // Show biometric prompt
      const credential = await navigator.credentials.create({
        publicKey: publicKey
      });

      if (!credential) {
        throw new Error('Credential creation failed or cancelled');
      }

      // Store credential locally (NO SERVER CALL)
      localStorage.setItem(this.CREDENTIAL_KEY, credential.id);
      localStorage.setItem(this.REGISTERED_KEY, 'true');
      localStorage.setItem(this.USER_KEY, userId);

      console.log('✅ Biometric registered successfully!');
      return {
        success: true,
        message: '✅ Face/Fingerprint registered for faster login!'
      };
    } catch (error) {
      console.error('❌ Biometric registration error:', error);
      return {
        success: false,
        message: error.message || 'Failed to register biometric'
      };
    }
  }

  /**
   * Authenticate with biometric (Face/Fingerprint)
   * Used for quick login - no server verification
   */
  async authenticateWithBiometric(userId) {
    try {
      console.log('🔍 Starting biometric authentication...');

      // Check if biometric is registered
      if (!this.isRegistered(userId)) {
        return {
          success: false,
          message: 'Biometric not registered for this user'
        };
      }

      const publicKey = {
        challenge: new Uint8Array(32),
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: []
      };

      // Show biometric prompt
      const assertion = await navigator.credentials.get({
        publicKey: publicKey
      });

      if (!assertion) {
        throw new Error('Biometric authentication cancelled');
      }

      console.log('✅ Biometric authentication successful!');
      return {
        success: true,
        message: '✅ Authenticated successfully!',
        userId: userId
      };
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      return {
        success: false,
        message: error.message || 'Biometric authentication failed'
      };
    }
  }

  /**
   * Unregister biometric (for settings)
   */
  unregisterBiometric() {
    try {
      localStorage.removeItem(this.CREDENTIAL_KEY);
      localStorage.removeItem(this.REGISTERED_KEY);
      localStorage.removeItem(this.USER_KEY);
      console.log('✅ Biometric unregistered');
      return { success: true, message: 'Biometric removed' };
    } catch (error) {
      console.error('❌ Unregister error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current registered user
   */
  getRegisteredUser() {
    return localStorage.getItem(this.USER_KEY);
  }

  /**
   * Clear all biometric data (for logout)
   */
  clear() {
    localStorage.removeItem(this.CREDENTIAL_KEY);
    localStorage.removeItem(this.REGISTERED_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

const biometricAuthService = new BiometricAuthService();
export default biometricAuthService;
