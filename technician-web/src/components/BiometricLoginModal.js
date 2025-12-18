import React, { useState, useEffect } from 'react';
import biometricAuthService from '../services/biometricAuthService';

/**
 * BiometricLoginModal
 * Shows biometric prompt when app starts if biometric is registered
 * Allows user to login with face/fingerprint instead of email/password
 */
const BiometricLoginModal = ({ onSuccess, onSkip }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('🔍 Checking biometric...');

  // Check for registered biometric on mount
  useEffect(() => {
    checkForBiometric();
  }, []);

  const checkForBiometric = async () => {
    try {
      const registeredUser = biometricAuthService.getRegisteredUser();
      if (!registeredUser) {
        // No biometric registered
        onSkip();
        return;
      }
      
      const isSupported = await biometricAuthService.isSupported();
      if (!isSupported) {
        // Device doesn't support biometric
        onSkip();
        return;
      }

      setMessage('🔐 Authenticating with biometric...');
    } catch (error) {
      console.error('Biometric check error:', error);
      onSkip();
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('📸 Waiting for biometric authentication...');

      const registeredUser = biometricAuthService.getRegisteredUser();
      if (!registeredUser) {
        throw new Error('No biometric registered');
      }

      const result = await biometricAuthService.authenticateWithBiometric(registeredUser);

      if (result.success) {
        setMessage('✅ ' + result.message);
        
        // Create session from stored data
        const auth = localStorage.getItem('auth');
        if (auth) {
          const authData = JSON.parse(auth);
          console.log('✅ Biometric authentication successful, proceeding to app');
        }

        setTimeout(() => {
          onSuccess();
        }, 600);
      } else {
        setError(result.message || 'Biometric authentication failed');
        setLoading(false);
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      setError(error.message || 'Biometric authentication failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #001a4d 0%, #003d99 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '40px 30px',
        maxWidth: '360px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.4s ease-out'
      }}>
        {/* Header */}
        <h1 style={{
          fontSize: '1.5rem',
          color: '#0066ff',
          margin: '0 0 10px 0',
          fontWeight: '700'
        }}>
          Welcome Back! 👋
        </h1>

        <p style={{
          color: '#666699',
          fontSize: '0.95rem',
          margin: '0 0 30px 0',
          lineHeight: '1.5'
        }}>
          Use your registered face or fingerprint to login instantly
        </p>

        {/* Status Message */}
        <div style={{
          background: '#f0f4ff',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <p style={{
            color: error ? '#e74c3c' : '#0066ff',
            fontSize: '0.9rem',
            margin: 0,
            fontWeight: '500'
          }}>
            {error || message}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <button
            onClick={handleBiometricLogin}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #0066ff, #0052cc)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 25px rgba(0, 102, 255, 0.3)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '⏳ Authenticating...' : '🔐 Use Biometric'}
          </button>

          <button
            onClick={onSkip}
            disabled={loading}
            style={{
              background: '#f0f4ff',
              color: '#0066ff',
              border: '2px solid #0066ff',
              borderRadius: '12px',
              padding: '16px 20px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            📧 Use Email/Password
          </button>
        </div>

        <p style={{
          color: '#9ca3af',
          fontSize: '0.8rem',
          margin: '20px 0 0 0'
        }}>
          Your biometric data stays secure on your device
        </p>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(40px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default BiometricLoginModal;
