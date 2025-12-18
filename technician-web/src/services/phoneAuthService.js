import { signInWithPhoneNumber, RecaptchaVerifier, signInWithCredential } from 'firebase/auth';
import { auth, db } from '../firebase';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';

class PhoneAuthService {
  constructor() {
    this.verificationId = null;
    this.recaptchaVerifier = null;
  }

  /**
   * Initialize reCAPTCHA for phone authentication
   * @param {HTMLElement} element - Container element for reCAPTCHA
   */
  initializeRecaptcha(element) {
    try {
      if (!this.recaptchaVerifier) {
        this.recaptchaVerifier = new RecaptchaVerifier(element, {
          size: 'invisible',
          callback: (response) => {
            console.log('✅ reCAPTCHA resolved');
          },
          'expired-callback': () => {
            console.log('⚠️ reCAPTCHA expired');
            this.recaptchaVerifier = null;
          }
        }, auth);
      }
      console.log('✅ reCAPTCHA Initialized');
    } catch (err) {
      console.error('reCAPTCHA initialization error:', err);
      throw new Error('reCAPTCHA initialization failed');
    }
  }

  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., +919876543210)
   * @returns {Promise<string>} Verification ID
   */
  async sendOTP(phoneNumber) {
    try {
      // Validate phone number format
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Phone number must include country code (e.g., +91)');
      }

      // Validate technician exists by phone
      const techExists = await this.validateTechnicianPhone(phoneNumber);
      if (!techExists) {
        throw new Error('Phone number not registered. Contact admin.');
      }

      // Send OTP via Firebase
      const appVerifier = this.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      this.verificationId = confirmationResult.verificationId;

      console.log('✅ OTP Sent to', phoneNumber);
      return confirmationResult.verificationId;
    } catch (err) {
      console.error('OTP Send Error:', err);
      throw new Error(err.message || 'Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify OTP and login
   * @param {string} otp - 6-digit OTP from SMS
   * @param {string} verificationId - Verification ID from sendOTP
   * @returns {Promise<object>} User session object
   */
  async verifyOTP(otp, verificationId) {
    try {
      if (!otp || otp.length !== 6) {
        throw new Error('OTP must be 6 digits');
      }

      // Verify credential using PhoneAuthProvider
      const PhoneAuthProvider = window.firebase.auth.PhoneAuthProvider;
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const user = result.user;

      // Get technician details from database
      const techRef = ref(db, 'technicians');
      const techQuery = query(techRef, orderByChild('phone'), equalTo(user.phoneNumber));
      const snapshot = await get(techQuery);

      if (!snapshot.exists()) {
        throw new Error('Technician record not found');
      }

      let technicianData = null;
      snapshot.forEach((childSnapshot) => {
        technicianData = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
      });

      // Save session
      const token = user.uid;
      const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      localStorage.setItem('auth', JSON.stringify({
        token,
        expiry,
        phone: user.phoneNumber,
        technicianId: technicianData.id,
        name: technicianData.name
      }));

      console.log('✅ OTP Verified - Login Successful:', user.phoneNumber);

      return {
        success: true,
        message: `Welcome ${technicianData.name}!`,
        user: {
          id: technicianData.id,
          phone: user.phoneNumber,
          name: technicianData.name,
          email: technicianData.email
        }
      };
    } catch (err) {
      console.error('OTP Verification Error:', err);
      throw new Error(err.message || 'Invalid OTP. Please try again.');
    }
  }

  /**
   * Validate technician phone in database
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Promise<boolean>}
   */
  async validateTechnicianPhone(phoneNumber) {
    try {
      const techRef = ref(db, 'technicians');
      const techQuery = query(techRef, orderByChild('phone'), equalTo(phoneNumber));
      const snapshot = await get(techQuery);
      return snapshot.exists();
    } catch (err) {
      console.error('Phone validation error:', err);
      return false;
    }
  }

  /**
   * Resend OTP
   * @returns {Promise<void>}
   */
  async resendOTP() {
    try {
      if (!this.recaptchaVerifier) {
        throw new Error('reCAPTCHA not initialized');
      }
      this.recaptchaVerifier.render();
      console.log('✅ reCAPTCHA re-rendered for OTP resend');
    } catch (err) {
      console.error('Resend OTP error:', err);
      throw new Error('Failed to resend OTP');
    }
  }

  /**
   * Clear verification state
   */
  clear() {
    this.verificationId = null;
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.delete();
      } catch (e) {
        // Ignore
      }
      this.recaptchaVerifier = null;
    }
  }
}

export default new PhoneAuthService();
