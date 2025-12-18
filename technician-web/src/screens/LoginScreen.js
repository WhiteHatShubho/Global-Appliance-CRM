import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import fcmService from '../services/fcmService';
import biometricAuthService from '../services/biometricAuthService';
import googleAuthService from '../services/googleAuthService';
import phoneAuthService from '../services/phoneAuthService';
import { getDatabase, ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { app } from '../firebase';
import * as faceapi from 'face-api.js';
import InteractiveLamp from '../components/InteractiveLamp';
import { showLoader, hideLoader } from '../utils/globalLoader';
import { GoogleLogo, FaceLogo, FingerprintLogo, EmailLogo } from '../components/AuthLogos';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lampOn, setLampOn] = useState(false);
  const [showBiometricPopup, setShowBiometricPopup] = useState(false);
  const [biometricUser, setBiometricUser] = useState(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const navigate = useNavigate();

  // Initialize Google Auth on mount
  useEffect(() => {
    try {
      googleAuthService.initialize(app);
      console.log('✅ Google Auth initialized');
    } catch (err) {
      console.error('Failed to initialize Google Auth:', err);
    }
  }, []);

  const handleCordClick = () => {
    setLampOn(!lampOn);
  };

  // Fingerprint/Biometric authentication
  const handleFingerprintLogin = async () => {
    try {
      setLoading(true);
      showLoader();
      setError('');
      setMessage('');

      const publicKey = {
        challenge: new Uint8Array(32),
        timeout: 60000,
        userVerification: 'preferred'
      };

      const credential = await navigator.credentials.get({ publicKey });

      if (credential) {
        console.log('✅ Fingerprint authentication successful');
        setMessage('✅ Fingerprint login successful — redirecting...');
        
        // Create a demo session for fingerprint login
        // In a real app, you would validate the credential against the server
        const session = sessionManager.createSession(
          'fingerprint_user_' + Date.now(),
          'Technician',
          'fingerprint@tech.local',
          '+1234567890'
        );
        
        // Auto-save token with 30-day expiry
        const token = `fingerprint_${Date.now()}`;
        const expiry = Date.now() + 30*24*60*60*1000;
        localStorage.setItem('auth', JSON.stringify({ token, expiry, email: 'fingerprint@tech.local' }));
        
        console.log('Session created for fingerprint login:', session);
        
        setTimeout(() => {
          navigate('/today-jobs');
        }, 600);
      } else {
        throw new Error('Fingerprint authentication cancelled');
      }
    } catch (err) {
      console.error('Fingerprint Authentication Failed:', err);
      setError('Fingerprint login not available. Please use email/password instead.');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  // Load face detection models from CDN
  const loadFaceModels = async () => {
    try {
      // Load from CDN instead of local files for easier setup
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      
      await faceapi.nets.tinyFaceDetector.load(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.load(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.load(MODEL_URL);
      await faceapi.nets.faceExpressionNet.load(MODEL_URL);
      console.log('✅ Face detection models loaded from CDN');
    } catch (err) {
      console.error('Failed to load face models:', err);
      throw new Error('Face detection models could not be loaded. Ensure you have internet connection.');
    }
  };

  // Face detection/facial recognition login
  const handleFaceLogin = async () => {
    try {
      setLoading(true);
      showLoader();
      setError('');
      setMessage('Loading face detection models...');

      // Load models
      await loadFaceModels();
      setMessage('📹 Starting camera...');

      // Get video element
      const videoElement = document.getElementById('faceLoginVideo');
      if (!videoElement) {
        throw new Error('Video element not found');
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      videoElement.srcObject = stream;

      // Wait for video to load
      await new Promise(resolve => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });

      setMessage('🔍 Detecting face...');

      // Try to detect face multiple times (up to 5 attempts with 1 second between)
      let detection = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (!detection && attempts < maxAttempts) {
        // Wait before attempting detection
        await new Promise(resolve => setTimeout(resolve, 800));
        
        try {
          // Detect face with more lenient options
          detection = await faceapi.detectSingleFace(
            videoElement,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 416,
              scoreThreshold: 0.5
            })
          );
          
          if (detection) {
            console.log('✅ Face detected on attempt', attempts + 1);
            break;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            setMessage(`🔍 Detecting face (attempt ${attempts + 1}/${maxAttempts})...`);
          }
        } catch (detectErr) {
          console.warn('Detection attempt', attempts + 1, 'failed:', detectErr.message);
          attempts++;
        }
      }

      // Stop the video stream
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;

      if (detection) {
        console.log('✅ Face detected successfully');
        setMessage('✅ Face recognized! Logging in...');

        // Create a demo session for face login
        // In a real app, you would validate the face against the server
        const session = sessionManager.createSession(
          'face_user_' + Date.now(),
          'Technician',
          'face@tech.local',
          '+1234567890'
        );
        
        // Auto-save token with 30-day expiry
        const token = `face_${Date.now()}`;
        const expiry = Date.now() + 30*24*60*60*1000;
        localStorage.setItem('auth', JSON.stringify({ token, expiry, email: 'face@tech.local' }));
        
        console.log('Session created for face login:', session);

        // Redirect after successful face detection
        setTimeout(() => {
          navigate('/today-jobs');
        }, 600);
      } else {
        throw new Error(`No face detected after ${maxAttempts} attempts. Please ensure your face is clearly visible, well-lit, and try again. Make sure there's good lighting and your face is centered in the camera.`);
      }
    } catch (err) {
      console.error('Face login error:', err);
      setError(err.message || 'Face recognition failed. Please use email/password instead.');
      hideLoader();
      setLoading(false);
    }
  };

  // Google login handler
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      showLoader();
      setError('');
      setMessage('🔵 Signing in with Google...');

      const result = await googleAuthService.signInWithGoogle();

      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setTimeout(() => {
          navigate('/today-jobs');
        }, 800);
      } else {
        setError(result.message);
        hideLoader();
        setLoading(false);
      }
    } catch (error) {
      console.error('Google login error:', error);
      setError('Google Sign-In failed. Please try again.');
      hideLoader();
      setLoading(false);
    }
  };

  const handleEmailLoginClick = () => {
    setShowEmailForm(!showEmailForm);
    setError('');
    setMessage('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    showLoader();

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter email and password');
      }

      // Get database reference
      const database = getDatabase();
      const techniciansRef = ref(database, 'technicians');
      
      // Search for technician by email
      const techQuery = query(
        techniciansRef,
        orderByChild('email'),
        equalTo(email.trim())
      );
      
      const snapshot = await get(techQuery);
      
      if (!snapshot.exists()) {
        throw new Error('Email not registered');
      }

      // Get technician data
      const techniciansData = snapshot.val();
      const technicianId = Object.keys(techniciansData)[0];
      const technicianData = techniciansData[technicianId];
      
      // Verify password
      if (technicianData.password !== password) {
        throw new Error('Incorrect password');
      }

      // Create session
      const session = sessionManager.createSession(
        technicianId,
        technicianData.name,
        email,
        technicianData.phone
      );
      
      // Auto-save token with 30-day expiry
      const token = `${email}_${Date.now()}`;
      const expiry = Date.now() + 30*24*60*60*1000; // Always 30 days
      localStorage.setItem('auth', JSON.stringify({ token, expiry, email }));
      
      console.log('Session created:', session);
      
      // Initialize FCM and get token
      try {
        await fcmService.registerServiceWorker();
        const fcmToken = await fcmService.getFCMTokenAndSync(technicianId);
        if (fcmToken) {
          console.log('✅ FCM initialized and token synced');
        } else {
          console.warn('⚠️ FCM token not obtained');
        }
        // Start listening for foreground messages
        fcmService.listenForForegroundMessages();
      } catch (fcmError) {
        console.error('FCM initialization error:', fcmError);
        // Don't block login if FCM fails
      }
      
      setMessage('Login successful!');
      
      // Check if biometric is supported and not yet registered
      const isBioSupported = await biometricAuthService.isSupported();
      const isBioRegistered = biometricAuthService.isRegistered(technicianId);
      
      if (isBioSupported && !isBioRegistered) {
        // Show biometric registration popup
        setBiometricUser({
          id: technicianId,
          name: technicianData.name,
          email: email
        });
        setShowBiometricPopup(true);
      } else {
        // No biometric support or already registered, go to jobs
        setTimeout(() => {
          navigate('/today-jobs');
        }, 600);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  // Handle biometric registration
  const handleBiometricRegister = async () => {
    try {
      setMessage('📸 Registering face/fingerprint...');
      setLoading(true);
      
      const result = await biometricAuthService.registerBiometric(
        biometricUser.id,
        biometricUser.name,
        biometricUser.email
      );
      
      if (result.success) {
        setMessage('✅ ' + result.message);
        setTimeout(() => {
          setShowBiometricPopup(false);
          navigate('/today-jobs');
        }, 800);
      } else {
        setError('Failed to register: ' + result.message);
      }
    } catch (error) {
      console.error('Biometric registration error:', error);
      setError(error.message || 'Failed to register biometric');
    } finally {
      setLoading(false);
    }
  };

  // Skip biometric registration
  const handleSkipBiometric = () => {
    setShowBiometricPopup(false);
    navigate('/today-jobs');
  };

  // Phone login - Send OTP
  const handleSendOTP = async () => {
    setOtpLoading(true);
    setError('');
    setMessage('');

    try {
      if (!phoneNumber.trim()) {
        throw new Error('Please enter phone number');
      }

      // Format phone number if needed
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0/, '');
      }

      // Initialize reCAPTCHA if not done
      const recaptchaContainer = document.getElementById('recaptcha-container');
      if (recaptchaContainer) {
        phoneAuthService.initializeRecaptcha(recaptchaContainer);
      }

      // Send OTP
      const verifyId = await phoneAuthService.sendOTP(formattedPhone);
      setVerificationId(verifyId);
      setShowOtpForm(true);
      setMessage(`✅ OTP sent to ${formattedPhone}`);
      console.log('📱 OTP Sent to:', formattedPhone);
    } catch (err) {
      console.error('Send OTP error:', err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // Phone login - Verify OTP
  const handleVerifyOTP = async () => {
    setLoading(true);
    showLoader();
    setError('');

    try {
      if (!otp.trim() || otp.length !== 6) {
        throw new Error('Please enter a valid 6-digit OTP');
      }

      if (!verificationId) {
        throw new Error('Verification ID not found. Please request OTP again.');
      }

      setMessage('🔐 Verifying OTP...');
      const result = await phoneAuthService.verifyOTP(otp, verificationId);

      if (result.success) {
        setMessage('✅ ' + result.message);
        setTimeout(() => {
          navigate('/today-jobs');
        }, 800);
      } else {
        setError(result.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setOtpLoading(true);
    setError('');
    setMessage('');

    try {
      await phoneAuthService.resendOTP();
      setMessage('✅ OTP resent. Check your SMS.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // Cancel phone login
  const handleCancelPhoneLogin = () => {
    phoneAuthService.clear();
    setShowPhoneForm(false);
    setShowOtpForm(false);
    setPhoneNumber('');
    setOtp('');
    setVerificationId(null);
    setError('');
    setMessage('');
  };

  // Initialize password reveal with mouse-tracking beam
  useEffect(() => {
    const root = document.documentElement;
    const eye = document.getElementById('eyeball');
    const beam = document.getElementById('beam');
    const passwordInput = document.getElementById('password');

    if (!eye || !beam || !passwordInput) return;

    const handleMouseMove = (e) => {
      let rect = beam.getBoundingClientRect();
      let mouseX = rect.right + (rect.width / 2); 
      let mouseY = rect.top + (rect.height / 2);
      let rad = Math.atan2(mouseX - e.pageX, mouseY - e.pageY);
      let degrees = (rad * (20 / Math.PI) * -1) - 350;

      root.style.setProperty('--beamDegrees', `${degrees}deg`);
    };

    const handleEyeClick = (e) => {
      e.preventDefault();
      document.body.classList.toggle('show-password');
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.focus();
    };

    root.addEventListener('mousemove', handleMouseMove);
    eye.addEventListener('click', handleEyeClick);

    return () => {
      root.removeEventListener('mousemove', handleMouseMove);
      eye.removeEventListener('click', handleEyeClick);
    };
  }, [lampOn]);

  return (
    <>
      <style>{`
        :root {
          --bgColor: white;
          --inputColor: black;
          --outlineColor: dodgerblue;
          --beamColor: yellow;
          --spacer: 1rem;
        }

        .pw-row {
          position: relative;
        }

        .pw-wrap {
          position: relative;
          display: flex;
          align-items: stretch;
          height: 2.5rem;
        }

        .pw-wrap input {
          flex: 1;
          padding: 0.75rem 4rem 0.75rem 0.75rem;
          width: 100%;
          border: 2px solid transparent;
          border-radius: 0;
          background-color: transparent;
          box-shadow: inset 0 0 0 2px black, inset 6px 6px 0 rgba(30, 144, 255, 0.2), 3px 3px 0 rgba(30, 144, 255, 0.2);
          -webkit-appearance: none;
          font-size: 1rem;
          font-family: monospace;
          color: var(--inputColor);
          box-sizing: border-box;
          margin: 0;
        }

        .pw-wrap input:focus {
          outline-offset: 1px;
          outline: 3px solid var(--outlineColor);
          outline-offset: 2px;
        }

        body.show-password .pw-wrap input {
          box-shadow: inset 0 0 0 2px black;
          border: 2px dashed white;
        }

        body.show-password .pw-wrap input:focus {
          outline: none;
          border-color: var(--beamColor);
        }

        #eyeball {
          --size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          outline: none;
          position: absolute;
          top: 0;
          right: 0.75rem;
          border: none;
          background-color: transparent;
          transform: translateY(0);
          height: 100%;
          z-index: 10;
        }

        #eyeball:active {
          transform: translateY(1px);
        }

        .eye {
          width: var(--size);
          height: var(--size);
          border: 2px solid var(--inputColor);
          border-radius: calc(var(--size) / 1.5) 0;
          transform: rotate(45deg);
          position: relative;
        }

        .eye::before,
        .eye::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          margin: auto;
          border-radius: 100%;
        }

        .eye::before {
          width: 35%;
          height: 35%;
          background-color: var(--inputColor);
        }

        .eye::after {
          width: 65%;
          height: 65%;
          border: 2px solid var(--inputColor);
          border-radius: 100%;
        }

        #beam {
          position: absolute;
          top: 50%;
          right: 1.75rem;
          -webkit-clip-path: polygon(100% 50%, 100% 50%, 0 0, 0 100%);
          clip-path: polygon(100% 50%, 100% 50%, 0 0, 0 100%);
          width: 100vw;
          height: 25vw;
          z-index: 1;
          mix-blend-mode: multiply;
          transition: transform 200ms ease-out;
          transform-origin: 100% 50%;
          transform: translateY(-50%) rotate(var(--beamDegrees, 0));
          pointer-events: none;
        }

        body.show-password #beam {
          background: var(--beamColor);
        }
      `}</style>
      <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #001a4d 0%, #003d99 100%)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '24px 24px 40px 24px',
      overflowY: 'scroll',
      WebkitOverflowScrolling: 'touch',
      color: '#001a4d',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'linear-gradient(145deg, #ffffff, #f0f4ff)',
        borderRadius: '24px',
        border: '2px solid #0066ff',
        boxShadow: '0 26px 60px rgba(0, 26, 77, 0.25)',
        padding: '24px 22px 26px',
        marginTop: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <h1 style={{ fontSize: '1.6rem', color: '#0066ff', fontWeight: '700', margin: '0 0 6px 0' }}>
            Technician Portal
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#666699', margin: '0' }}>
            Pull the cord to wake the lamp and log in ✨
          </p>
        </div>

        {/* Lamp Box */}
        <div style={{
          background: '#f8faff',
          borderRadius: '18px',
          border: '2px solid #0066ff',
          padding: '28px 10px 18px',
          marginBottom: '22px',
          position: 'relative',
          zIndex: 1
        }}>
          <InteractiveLamp lampOn={lampOn} onToggle={handleCordClick} />
        </div>

        {/* Logo */}
        <div style={{
          margin: '12px auto 4px',
          textAlign: 'center',
          opacity: lampOn ? 1 : 0,
          transform: lampOn ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease, filter 0.4s ease',
          fontSize: '1.8rem',
          fontWeight: '700',
          letterSpacing: '0.05em',
          color: '#0066ff',
          textTransform: 'uppercase',
          maxWidth: '200px',
          position: 'relative',
          zIndex: 2,
          filter: lampOn ? 'brightness(1)' : 'brightness(0.2)'
        }}>
          Global Appliance
        </div>

        {/* Login Form */}
        {lampOn && (
          <form onSubmit={handleLogin} style={{
            marginTop: '8px',
            opacity: lampOn ? 1 : 0,
            transform: lampOn ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease, filter 0.4s ease',
            position: 'relative',
            zIndex: 2,
            filter: lampOn ? 'brightness(1)' : 'brightness(0.3)'
          }}>
            {error && (
              <div style={{
                background: '#f8d7da',
                color: '#721c24',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                background: '#d4edda',
                color: '#155724',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '0.9rem'
              }}>
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '999px',
                padding: '11px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #ea4335, #c5221f)',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 16px 40px rgba(234, 67, 53, 0.3)',
                transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <GoogleLogo />
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={handleFingerprintLogin}
              disabled={loading}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '999px',
                padding: '11px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 16px 40px rgba(99, 102, 241, 0.3)',
                transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                marginTop: '10px',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FingerprintLogo />
              <span>Fingerprint</span>
            </button>

            <button
              type="button"
              onClick={handleFaceLogin}
              disabled={loading}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '999px',
                padding: '11px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 16px 40px rgba(236, 72, 153, 0.3)',
                transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                marginTop: '10px',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FaceLogo />
              <span>Face</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPhoneForm(!showPhoneForm)}
              disabled={loading}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '999px',
                padding: '11px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 16px 40px rgba(16, 185, 129, 0.3)',
                transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                marginTop: '10px',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>{showPhoneForm ? '✕' : '📱'}</span>
              <span>{showPhoneForm ? 'Hide Phone' : 'Phone'}</span>
            </button>

            {showPhoneForm && !showOtpForm && (
            <div style={{ marginBottom: '14px', marginTop: '20px' }}>
              <label style={{
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                display: 'block',
                marginBottom: '5px'
              }} htmlFor="phone">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 9876543210 or 9876543210"
                disabled={otpLoading}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '999px',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  padding: '10px 14px',
                  color: '#f9fafb',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={otpLoading || !phoneNumber.trim()}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '11px 14px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  background: otpLoading ? '#999' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  cursor: otpLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 16px 40px rgba(16, 185, 129, 0.3)',
                  transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                  marginTop: '10px'
                }}
              >
                {otpLoading ? '⏳ Sending...' : '📤 Send OTP'}
              </button>
            </div>
            )}

            {showPhoneForm && showOtpForm && (
            <div style={{ marginBottom: '14px', marginTop: '20px' }}>
              <label style={{
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                display: 'block',
                marginBottom: '5px'
              }} htmlFor="otp">
                Enter OTP (6 digits)
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '999px',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  padding: '10px 14px',
                  color: '#f9fafb',
                  fontSize: '1.5rem',
                  letterSpacing: '0.5em',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '11px 14px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  background: loading || otp.length !== 6 ? '#999' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 16px 40px rgba(16, 185, 129, 0.3)',
                  transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                  marginTop: '10px'
                }}
              >
                {loading ? '🔐 Verifying...' : '✅ Verify OTP'}
              </button>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={otpLoading}
                style={{
                  width: '100%',
                  border: '2px solid #10b981',
                  background: 'transparent',
                  borderRadius: '999px',
                  padding: '10px 14px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#10b981',
                  cursor: otpLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  marginTop: '8px',
                  opacity: otpLoading ? 0.6 : 1
                }}
              >
                {otpLoading ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>
            )}

            <button
              type="button"
              onClick={handleEmailLoginClick}
              disabled={loading}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '999px',
                padding: '11px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #0066ff, #004bb8)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 16px 40px rgba(0, 102, 255, 0.3)',
                transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>{showEmailForm ? '✕' : <EmailLogo />}</span>
              <span>{showEmailForm ? 'Hide Email' : 'Email'}</span>
            </button>

            {showEmailForm && (
            <>
            <div style={{ marginBottom: '14px', marginTop: '20px' }}>
              <label style={{
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                display: 'block',
                marginBottom: '5px'
              }} htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '999px',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  padding: '10px 14px',
                  color: '#f9fafb',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#9ca3af',
                  display: 'block',
                  marginBottom: '5px'
                }} htmlFor="password">
                  Password
                </label>
                <div className="pw-row">
                  <div className="pw-wrap">
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      disabled={loading}
                      aria-label="Password"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button 
                      id="eyeball" 
                      aria-label="Toggle password visibility"
                      type="button"
                    >
                      <div className="eye"></div>
                    </button>
                    <div id="beam"></div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '11px 14px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #0066ff, #004bb8)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 16px 40px rgba(0, 102, 255, 0.3)',
                  transition: 'transform 0.12s, box-shadow 0.12s, filter 0.12s',
                  marginTop: '10px'
                }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </>
            )}

            <video
              id="faceLoginVideo"
              style={{
                display: 'none',
                width: '640px',
                height: '480px'
              }}
            />

            <p style={{
              marginTop: '10px',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: '#9ca3af'
            }}>
              Contact admin for account creation
            </p>
          </form>
        )}
      </div>

      {/* Biometric Registration Popup */}
      {showBiometricPopup && biometricUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '380px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <h2 style={{
              fontSize: '1.4rem',
              color: '#0066ff',
              margin: '0 0 10px 0',
              fontWeight: '700'
            }}>
              📸 Register Face/Fingerprint?
            </h2>
            
            <p style={{
              color: '#666699',
              fontSize: '0.95rem',
              margin: '0 0 8px 0',
              lineHeight: '1.5'
            }}>
              Register your face or fingerprint for faster, easier login next time — just like Paytm!
            </p>

            <p style={{
              color: '#9ca3af',
              fontSize: '0.85rem',
              margin: '0 0 20px 0'
            }}>
              You can skip this and do it later in settings.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={handleBiometricRegister}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #0066ff, #0052cc)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 25px rgba(0, 102, 255, 0.3)',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? '⏳ Processing...' : '✅ Register Now'}
              </button>
              
              <button
                onClick={handleSkipBiometric}
                disabled={loading}
                style={{
                  background: '#f0f4ff',
                  color: '#0066ff',
                  border: '2px solid #0066ff',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                ⏭️ Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
    </>
  );
};

export default LoginScreen;