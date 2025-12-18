import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import notificationPermissionManager from '../services/notificationPermissionManager';

const NotificationPermissionScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [message, setMessage] = useState('Checking notification permissions...');

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    setLoading(true);
    
    // Check if notifications are enabled
    const isEnabled = notificationPermissionManager.areNotificationsEnabled();
    
    if (isEnabled) {
      // Notifications already enabled - proceed to app
      setPermissionStatus('granted');
      setMessage('✅ Notifications enabled! Proceeding to app...');
      
      // Wait 1 second before navigating
      setTimeout(() => {
        notificationPermissionManager.markPermissionChecked();
        navigate('/today-jobs', { replace: true });
      }, 1000);
    } else {
      // Notifications not enabled
      setPermissionStatus('denied');
      setMessage('Notifications are required for job alerts');
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    setMessage('Requesting notification permission...');

    const permission = await notificationPermissionManager.requestNotificationPermission();

    if (permission) {
      setPermissionStatus('granted');
      setMessage('✅ Notifications enabled! Proceeding to app...');
      
      // Send test notification
      notificationPermissionManager.sendTestNotification();

      // Navigate after short delay
      setTimeout(() => {
        notificationPermissionManager.markPermissionChecked();
        navigate('/today-jobs', { replace: true });
      }, 1500);
    } else {
      setPermissionStatus('denied');
      setMessage('❌ Please enable notifications to continue');
      setLoading(false);
    }
  };

  const handleOpenSettings = () => {
    setMessage('📱 Please follow the instructions in the console to enable notifications');
    notificationPermissionManager.openNotificationSettings();
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <img 
          src="/logo.svg" 
          alt="Global Appliance" 
          style={{
            height: '80px',
            marginBottom: '20px',
            width: 'auto'
          }}
        />

        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '10px',
          margin: '0 0 10px 0'
        }}>
          🔔 Enable Notifications
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '20px',
          lineHeight: '1.6',
          margin: '0 0 20px 0'
        }}>
          Notifications are <strong>required</strong> to receive new job alerts and ensure you never miss urgent assignments.
        </p>

        {/* Status message */}
        <div style={{
          padding: '15px',
          backgroundColor: permissionStatus === 'granted' ? '#d4edda' : '#fff3cd',
          borderRadius: '8px',
          marginBottom: '30px',
          color: permissionStatus === 'granted' ? '#155724' : '#856404',
          borderLeft: `4px solid ${permissionStatus === 'granted' ? '#28a745' : '#ffc107'}`
        }}>
          <p style={{ margin: '0', fontSize: '14px' }}>
            {message}
          </p>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #0066ff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        )}

        {/* Why notifications matter */}
        {permissionStatus !== 'granted' && !loading && (
          <div style={{
            backgroundColor: '#f9f9f9',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '25px',
            textAlign: 'left',
            fontSize: '14px',
            lineHeight: '1.8',
            color: '#555'
          }}>
            <p style={{ fontWeight: 'bold', marginTop: '0' }}>Why notifications are mandatory:</p>
            <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
              <li>📢 Receive instant job alerts</li>
              <li>🔊 Hear alert sound even when app is closed</li>
              <li>⚡ Never miss urgent jobs</li>
              <li>📱 Get vibration notifications on mobile</li>
            </ul>
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {permissionStatus !== 'granted' && (
            <>
              <button
                onClick={handleEnableNotifications}
                disabled={loading}
                style={{
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: loading ? '#ccc' : '#0066ff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s'
                }}
                onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#0052cc')}
                onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#0066ff')}
              >
                {loading ? '⏳ Enabling...' : '✅ Enable Notifications'}
              </button>

              <button
                onClick={handleOpenSettings}
                disabled={loading}
                style={{
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#0066ff',
                  backgroundColor: 'transparent',
                  border: '2px solid #0066ff',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#f0f0f0')}
                onMouseOut={(e) => !loading && (e.target.style.backgroundColor = 'transparent')}
              >
                📱 Open App Settings
              </button>
            </>
          )}

          {permissionStatus === 'granted' && (
            <button
              onClick={() => navigate('/today-jobs', { replace: true })}
              style={{
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: '#28a745',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ✅ Continue to App
            </button>
          )}
        </div>

        {/* Legal note */}
        <p style={{
          fontSize: '12px',
          color: '#999',
          marginTop: '20px',
          marginBottom: '0'
        }}>
          Notifications are essential for receiving job alerts. This app cannot function without them.
        </p>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NotificationPermissionScreen;
