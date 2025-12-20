import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import sessionManager from './services/sessionManager';
import biometricAuthService from './services/biometricAuthService';
import appPermissionManager from './services/appPermissionManager';
import attendanceAlarmService from './services/attendanceAlarmService';
import LoginScreen from './screens/LoginScreen';
import BiometricLoginModal from './components/BiometricLoginModal';
import TodayJobsScreen from './screens/TodayJobsScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import AttendanceHistoryScreen from './screens/AttendanceHistoryScreen';
import JobDetailsScreen from './screens/JobDetailsScreen';
import JobCompleteScreen from './screens/JobCompleteScreen';
import PaymentScreen from './screens/PaymentScreen';
import ProfileScreen from './screens/ProfileScreen';
import PermissionScreen from './screens/PermissionScreen';
import CompletedJobsScreen from './screens/CompletedJobsScreen'; // Added Completed Jobs Screen
import PayrollViewScreen from './screens/PayrollViewScreen'; // Added Payroll View Screen
import ExpandingMenu from './components/ExpandingMenu'; // Added Expanding Menu
import './App.css';

function App() {
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);
  const location = useLocation();

  // Check and request permissions on first launch
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 App initializing...');
      
      // Register service worker for offline support and performance
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          console.log('✅ Service Worker registered:', registration);
        } catch (error) {
          console.log('⚠️ Service Worker registration failed:', error);
        }
      }
      
      // Request notification permission for attendance alarm
      attendanceAlarmService.constructor.requestNotificationPermission();
      
      // Check session FIRST - this is most important
      const validSession = sessionManager.hasValidSession();
      console.log('🔑 Valid session:', validSession);
      
      if (validSession) {
        setHasSession(true);
        // Initialize attendance alarm when user is logged in
        attendanceAlarmService.initialize();
      } else {
        const registeredUser = biometricAuthService.getRegisteredUser();
        if (registeredUser) {
          console.log('📱 Biometric registered, showing biometric login');
          setShowBiometricLogin(true);
        }
      }
      
      const permissionsAlreadyGranted = localStorage.getItem('permissionsRequested') === 'true' 
        && localStorage.getItem('cameraPermissionGranted') === 'true';
      
      if (permissionsAlreadyGranted) {
        console.log('✅ Permissions already granted - skipping permission screen');
        setPermissionsGranted(true);
      } else {
        console.log('📋 Need to request permissions');
        setPermissionsGranted(false);
      }
      
      setCheckingPermissions(false);
      setLoading(false);
    };

    initializeApp();
    
    // Check session status periodically
    const interval = setInterval(() => {
      const currentSession = sessionManager.hasValidSession();
      setHasSession(currentSession);
    }, 5000); // Check every 5 seconds (not every second)
    
    return () => {
      clearInterval(interval);
      attendanceAlarmService.destroy();
    };
  }, []);

  // Check and request permissions on first launch

  // Handle back button for Android/mobile devices
  useEffect(() => {
    // Prevent browser default back behavior
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = (event) => {
      event.preventDefault();
      
      // Check current location
      const currentPath = location.pathname;
      const isHomeScreen = currentPath === '/today-jobs' || currentPath === '/';
      
      if (isHomeScreen) {
        // Show exit confirmation on home screen
        setShowExitConfirm(true);
      } else {
        // Navigate back to previous page using browser history
        window.history.back();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location]);

  if (loading || checkingPermissions) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#001a4d',
        color: 'white'
      }}>
        <div>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Show permission screen if permissions not granted
  if (!permissionsGranted) {
    return (
      <PermissionScreen 
        onPermissionGranted={() => {
          console.log('✅ Permissions granted - proceeding to app');
          setPermissionsGranted(true);
        }} 
      />
    );
  }

  // Show biometric login if available
  if (showBiometricLogin) {
    return (
      <BiometricLoginModal
        onSuccess={() => {
          console.log('✅ Biometric login successful');
          // Re-check session after biometric success
          const validSession = sessionManager.hasValidSession();
          setHasSession(validSession);
          setShowBiometricLogin(false);
        }}
        onSkip={() => {
          console.log('⏭️ Skipping biometric, showing login screen');
          setShowBiometricLogin(false);
        }}
      />
    );
  }

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    // Clear session and exit
    sessionManager.clearSession();
    localStorage.removeItem('isAdmin');
    // Simulate app close by redirecting to a close page
    // For web apps, we can show a goodbye message
    window.location.href = 'about:blank';
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
    // Push state again to prevent back button default
    window.history.pushState(null, '', window.location.href);
  };

  return (
    <>
      {/* Global Loading Overlay - MUST EXIST FOR showLoader() / hideLoader() TO WORK */}
      <div 
        id="globalLoader"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f0f0f0',
            borderTopColor: '#0066ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px'
          }}></div>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666',
            fontWeight: '500'
          }}>Loading...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>

      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/today-jobs" element={hasSession ? <TodayJobsScreen /> : <Navigate to="/login" />} />
        <Route path="/completed-jobs" element={hasSession ? <CompletedJobsScreen /> : <Navigate to="/login" />} /> {/* Added Completed Jobs Route */}
        <Route path="/attendance" element={hasSession ? <AttendanceScreen /> : <Navigate to="/login" />} />
        <Route path="/attendance-history" element={hasSession ? <AttendanceHistoryScreen /> : <Navigate to="/login" />} />
        <Route path="/payroll" element={hasSession ? <PayrollViewScreen /> : <Navigate to="/login" />} />
        <Route path="/job-details/:id" element={hasSession ? <JobDetailsScreen /> : <Navigate to="/login" />} />
        <Route path="/job-complete/:id" element={hasSession ? <JobCompleteScreen /> : <Navigate to="/login" />} />
        <Route path="/payment/:id" element={hasSession ? <PaymentScreen /> : <Navigate to="/login" />} />
        <Route path="/profile" element={hasSession ? <ProfileScreen /> : <Navigate to="/login" />} />
        <Route path="/" element={hasSession ? <Navigate to="/today-jobs" /> : <Navigate to="/login" />} />
      </Routes>

      {/* Show expanding menu only when user is logged in and not on login screen */}
      {hasSession && location.pathname !== '/login' && (
        <ExpandingMenu />
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '300px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#001a4d', fontSize: '1.3rem' }}>Exit App?</h2>
            <p style={{ marginBottom: '25px', color: '#666', fontSize: '1rem' }}>Do you want to exit the Global Appliance Tech app?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleExitCancel}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '80px'
                }}
              >
                No
              </button>
              <button
                onClick={handleExitConfirm}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '80px'
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
