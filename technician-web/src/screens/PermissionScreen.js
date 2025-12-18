import React, { useState } from 'react';
import appPermissionManager from '../services/appPermissionManager';

/**
 * Permission Request Screen
 * Displayed when required permissions (camera, notifications) are not granted
 * Forces user to grant permissions before using the app
 */
function PermissionScreen({ onPermissionGranted }) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleRequestPermissions = async () => {
    setRequesting(true);
    setError('');

    try {
      const results = await appPermissionManager.requestAllPermissions();
      
      if (results.camera) {
        // Camera granted - can proceed
        onPermissionGranted();
      } else {
        // Camera denied - show settings option
        setShowSettings(true);
        setError('Camera permission is required to use this app. Please enable it in Settings.');
      }
    } catch (err) {
      setError('Error requesting permissions. Please try again.');
      console.error('Permission request error:', err);
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    setRequesting(true);
    try {
      const opened = await appPermissionManager.openAppSettings('camera');
      if (opened) {
        // Permission was granted
        setError('');
        setShowSettings(false);
        localStorage.setItem('permissionsRequested', 'true');
        localStorage.setItem('cameraPermissionGranted', 'true');
        onPermissionGranted();
      } else {
        // Permission still denied, show instructions
        const message = 'ENABLE CAMERA PERMISSION\n\nTo enable camera permission:\n\n1. Open your device Settings\n2. Go to: Apps > Global Appliance Tech\n3. Tap: Permissions or App Permissions\n4. Find: Camera\n5. Select: Allow or Allow while using the app\n6. Return to this app and tap \'I\'ve Enabled Permissions\'';
        alert(message);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to open settings. Please manually enable camera permission.');
    } finally {
      setRequesting(false);
    }
  };

  const handleRetry = async () => {
    setError('');
    setShowSettings(false);
    
    // Check if permission was granted in settings
    const hasCamera = await appPermissionManager.verifyCameraPermission();
    if (hasCamera) {
      // Update localStorage to mark permissions as granted
      localStorage.setItem('permissionsRequested', 'true');
      localStorage.setItem('cameraPermissionGranted', 'true');
      console.log('✅ Camera permission verified and stored');
      onPermissionGranted();
    } else {
      setError('Camera permission is still not granted. Please enable it to continue.');
      setShowSettings(true);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#001a4d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: 'white'
    }}>
      {/* Logo */}
      <div style={{
        width: '120px',
        height: '120px',
        backgroundColor: 'white',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <img 
          src="/logo.svg" 
          alt="Logo" 
          style={{ width: '80px', height: '80px' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '1.8rem',
        fontWeight: '700',
        marginBottom: '10px',
        textAlign: 'center'
      }}>
        Global Appliance Tech
      </h1>

      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: '400',
        marginBottom: '30px',
        opacity: 0.9,
        textAlign: 'center'
      }}>
        App Permissions Required
      </h2>

      {/* Permission Info Card */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '350px',
        width: '100%',
        marginBottom: '30px'
      }}>
        <p style={{
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          To use this app, we need your permission for:
        </p>

        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>📸</span>
            <div>
              <strong>Camera</strong>
              <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>
                Required for photo capture during job completion and attendance
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>🔔</span>
            <div>
              <strong>Notifications</strong>
              <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>
                Required to receive new job alerts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>📍</span>
            <div>
              <strong>Location</strong>
              <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>
                Required for marking attendance with location
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(231, 76, 60, 0.2)',
          border: '1px solid rgba(231, 76, 60, 0.5)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          maxWidth: '350px',
          width: '100%',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>⚠️ {error}</p>
        </div>
      )}

      {/* Action Buttons */}
      {!showSettings ? (
        <button
          onClick={handleRequestPermissions}
          disabled={requesting}
          style={{
            backgroundColor: '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 40px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: requesting ? 'not-allowed' : 'pointer',
            opacity: requesting ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)'
          }}
        >
          {requesting ? (
            <>
              <span className="spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              Requesting...
            </>
          ) : (
            <>
              ✓ Grant Permissions
            </>
          )}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
          <button
            onClick={handleOpenSettings}
            disabled={requesting}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 30px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: requesting ? 'not-allowed' : 'pointer',
              opacity: requesting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {requesting ? (
              <>
                <span className="spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></span>
                Processing...
              </>
            ) : (
              <>
                ⚙️ Open App Settings
              </>
            )}
          </button>
          
          <button
            onClick={handleRetry}
            disabled={requesting}
            style={{
              backgroundColor: '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 30px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: requesting ? 'not-allowed' : 'pointer',
              opacity: requesting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🔄 I've Enabled Permissions
          </button>
        </div>
      )}

      {/* Instructions */}
      <p style={{
        fontSize: '0.8rem',
        opacity: 0.6,
        marginTop: '30px',
        textAlign: 'center',
        maxWidth: '300px'
      }}>
        Without these permissions, you cannot capture photos for job completion or mark attendance.
      </p>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PermissionScreen;
