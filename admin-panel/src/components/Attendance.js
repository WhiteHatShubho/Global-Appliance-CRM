import React, { useState, useEffect, useRef } from 'react';
import attendanceService from '../services/attendanceService';

const Attendance = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanPhase, setScanPhase] = useState('idle'); // idle, scanning, verifying
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMatchScore, setFaceMatchScore] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize attendance on component mount
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const userData = JSON.parse(user);
      setCurrentUser(userData);
      loadTodayAttendance(userData.id);
    } else {
      setError('User session not found. Please login first.');
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load today's attendance
  const loadTodayAttendance = async (userId) => {
    try {
      const attendance = await attendanceService.getTodayAttendance(userId);
      setTodayAttendance(attendance);
    } catch (err) {
      console.error('Error loading attendance:', err);
    }
  };

  // Request camera permission and start video
  const startCamera = async () => {
    try {
      setLoading(true);
      setError('');

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }

      setSuccess('📹 Camera started. Please position your face in the frame.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('❌ Camera access denied. Please allow camera permission and try again.');
      console.error('Camera error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setCameraActive(false);
      setScanPhase('idle');
      setFaceDetected(false);
    }
  };

  // Scan face for attendance
  const scanFace = async (type) => {
    try {
      if (!cameraActive) {
        setError('❌ Camera not started');
        return;
      }

      setLoading(true);
      setScanPhase('scanning');
      setError('');

      // Give user time to position face
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Detect face
      const detection = await attendanceService.detectFace(videoRef.current);

      if (!detection.success) {
        setError(detection.message);
        setScanPhase('idle');
        return;
      }

      setFaceDetected(true);
      setScanPhase('verifying');

      // Record attendance
      const result = await attendanceService.recordAttendance(
        currentUser.id,
        type,
        detection.descriptor
      );

      if (result.success) {
        setSuccess(result.message);
        setFaceMatchScore(result.record?.faceMatchScore || 1.0);

        // Reload attendance
        await loadTodayAttendance(currentUser.id);

        // Close camera after 2 seconds
        setTimeout(() => {
          stopCamera();
        }, 2000);
      } else {
        setError(result.message);
        setFaceMatchScore(result.matchScore || 0);
        setScanPhase('idle');
      }
    } catch (err) {
      setError('❌ Error: ' + err.message);
      setScanPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const canCheckIn = !todayAttendance || !todayAttendance.checkInTime;
  const canCheckOut = todayAttendance && todayAttendance.checkInTime && !todayAttendance.checkOutTime;

  return (
    <div className="content" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>📍 Attendance Marking</h1>
      <p style={{ color: '#666', marginBottom: '25px' }}>
        Mark your daily attendance using AI Face Recognition
      </p>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '12px 15px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#c62828',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 15px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '4px',
          color: '#2e7d32',
          marginBottom: '20px'
        }}>
          {success}
        </div>
      )}

      {/* Today's Status Card */}
      {todayAttendance && (
        <div className="card" style={{
          marginBottom: '25px',
          backgroundColor: '#f5f5f5',
          borderLeft: '4px solid #2196f3'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📊 Today's Status</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-in Time</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#2e7d32' }}>
                {todayAttendance.checkInTime || '⏳ Pending'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-out Time</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#d32f2f' }}>
                {todayAttendance.checkOutTime || '⏳ Pending'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Working Hours</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#ff6f00' }}>
                {todayAttendance.workingHours ? todayAttendance.workingHours + 'h' : 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Status</p>
              <p style={{
                margin: '5px 0 0 0',
                fontSize: '16px',
                fontWeight: 'bold',
                color: todayAttendance.status === 'completed' ? '#2e7d32' : '#ff6f00',
                textTransform: 'uppercase'
              }}>
                {todayAttendance.status === 'completed' ? '✅ Completed' : '⏳ ' + todayAttendance.status}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Camera Section */}
      <div className="card" style={{
        marginBottom: '20px',
        backgroundColor: '#fafafa',
        padding: '20px',
        borderRadius: '8px',
        border: '2px solid #e0e0e0'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>📹 Face Recognition Camera</h3>

        {cameraActive ? (
          <div style={{ marginBottom: '20px' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxWidth: '500px',
                borderRadius: '8px',
                border: '2px solid #2196f3',
                backgroundColor: '#000',
                display: 'block',
                margin: '0 auto 15px'
              }}
            />
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />

            {/* Status Indicator */}
            <div style={{
              textAlign: 'center',
              padding: '15px',
              backgroundColor: '#e3f2fd',
              borderRadius: '4px',
              marginBottom: '15px'
            }}>
              <p style={{ margin: '0', fontSize: '14px', color: '#1976d2' }}>
                {scanPhase === 'idle' && '👁️ Position your face clearly in the frame'}
                {scanPhase === 'scanning' && '🔍 Scanning your face...'}
                {scanPhase === 'verifying' && '✓ Verifying face match...'}
                {faceDetected && faceMatchScore > 0 && ` | Match Score: ${(faceMatchScore * 100).toFixed(0)}%`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {canCheckIn && (
                <button
                  className="btn"
                  style={{ backgroundColor: '#4caf50', padding: '12px 30px', fontSize: '16px', fontWeight: 'bold' }}
                  onClick={() => scanFace('check-in')}
                  disabled={loading || scanPhase !== 'idle'}
                >
                  {loading && scanPhase !== 'idle' ? '⏳ Processing...' : '✅ Check-In'}
                </button>
              )}

              {canCheckOut && (
                <button
                  className="btn"
                  style={{ backgroundColor: '#ff9800', padding: '12px 30px', fontSize: '16px', fontWeight: 'bold' }}
                  onClick={() => scanFace('check-out')}
                  disabled={loading || scanPhase !== 'idle'}
                >
                  {loading && scanPhase !== 'idle' ? '⏳ Processing...' : '🚪 Check-Out'}
                </button>
              )}

              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', padding: '12px 30px', fontSize: '16px' }}
                onClick={stopCamera}
                disabled={loading}
              >
                Close Camera
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <p style={{ color: '#999', marginBottom: '20px' }}>
              {todayAttendance?.status === 'completed'
                ? '✅ Your attendance for today is complete.'
                : 'Click below to start camera and begin face recognition'}
            </p>
            {todayAttendance?.status !== 'completed' && (
              <button
                className="btn"
                style={{
                  backgroundColor: '#2196f3',
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
                onClick={startCamera}
                disabled={loading}
              >
                {loading ? '⏳ Starting...' : '📹 Start Camera'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Information Box */}
      <div className="card" style={{ backgroundColor: '#f0f4ff', borderLeft: '4px solid #2196f3' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>ℹ️ How to Mark Attendance</h4>
        <ol style={{ margin: '0', paddingLeft: '20px', color: '#555', lineHeight: '1.8' }}>
          <li>Click "Start Camera" to enable your webcam</li>
          <li>Position your face clearly in the center of the frame</li>
          <li>Make sure adequate lighting is available</li>
          <li>Click "Check-In" when you arrive at work</li>
          <li>Click "Check-Out" when you leave work</li>
          <li>Your face will be automatically verified using AI</li>
          <li>Attendance will be recorded with exact time stamps</li>
        </ol>

        <h4 style={{ margin: '15px 0 10px 0', color: '#1976d2' }}>🔐 Privacy & Security</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#555', lineHeight: '1.8' }}>
          <li>Face images are NOT stored - only face patterns are kept</li>
          <li>Camera only works on this attendance page</li>
          <li>Face recognition happens on your device (end-to-end encrypted)</li>
          <li>No personal data is sent to external servers</li>
        </ul>
      </div>
    </div>
  );
};

export default Attendance;
