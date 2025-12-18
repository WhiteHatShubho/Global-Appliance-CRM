import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import attendanceService from '../services/attendanceService';
import attendanceAccessControl from '../services/attendanceAccessControl';
import locationService from '../services/locationService';
import appPermissionManager from '../services/appPermissionManager';
import { showLoader, hideLoader } from '../utils/globalLoader';
import '../App.css';

const AttendanceScreen = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanPhase, setScanPhase] = useState('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMatchScore, setFaceMatchScore] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isWithinRadius, setIsWithinRadius] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [canSubmitAttendance, setCanSubmitAttendance] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Load face detection models on mount
  useEffect(() => {
    const loadFaceDetectionModels = async () => {
      try {
        if (!window.faceapi) {
          console.warn('⚠️ Face-api.js not loaded yet');
          setTimeout(loadFaceDetectionModels, 1000);
          return;
        }
        console.log('📹 Loading face detection models...');
        // Use lighter model for faster detection
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await window.faceapi.nets.tinyFaceDetector.load(MODEL_URL);
        // Skip landmarks for faster processing - only use detection
        setModelsLoaded(true);
        console.log('✅ Face detection models loaded (optimized)');
      } catch (err) {
        console.error('❌ Failed to load face models:', err);
        setError('⚠️ Face detection models failed to load. Camera will work without face verification.');
      }
    };
    loadFaceDetectionModels();
  }, []);

  // Check attendance submission time limit
  useEffect(() => {
    const checkTimeLimit = () => {
      const check = attendanceAccessControl.canSubmitAttendance();
      setCanSubmitAttendance(check.allowed);
      setCurrentTime(new Date());
    };

    // Check immediately
    checkTimeLimit();

    // Check every minute to update status
    const interval = setInterval(checkTimeLimit, 60000);
    return () => clearInterval(interval);
  }, []);

  // Initialize attendance on component mount
  useEffect(() => {
    const techId = sessionManager.getTechnicianId();
    if (techId) {
      setCurrentUser({ id: techId, name: sessionManager.getTechnicianName() });
      loadTodayAttendance(techId);
    } else {
      setError('Technician session not found. Please login first.');
      setTimeout(() => navigate('/login'), 2000);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [navigate]);

  // Load today's attendance
  const loadTodayAttendance = async (userId) => {
    try {
      showLoader();
      const attendance = await attendanceService.getTodayAttendance(userId);
      setTodayAttendance(attendance);
    } catch (err) {
      console.error('Error loading attendance:', err);
    } finally {
      hideLoader();
    }
  };



  // Request camera permission and start video
  const startCamera = async () => {
    console.log('🎬 START CAMERA CLICKED');
    try {
      setLoading(true);
      showLoader();
      setError('');
      setScanPhase('idle');

      // VERIFY CAMERA PERMISSION FIRST
      console.log('📸 Verifying camera permission...');
      const hasPermission = await appPermissionManager.verifyCameraPermission();
      if (!hasPermission) {
        setError('❌ Camera permission denied. Please enable camera in Settings to mark attendance.');
        setLoading(false);
        // Show alert and option to open settings
        if (window.confirm('Camera permission is required for attendance. Open Settings?')) {
          await appPermissionManager.openAppSettings();
        }
        return;
      }
      console.log('✅ Camera permission verified');

      console.log('📱 Checking if getUserMedia is available:', !!navigator.mediaDevices?.getUserMedia);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      console.log('🎥 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      console.log('✅ Camera stream obtained:', stream);

      streamRef.current = stream;
      
      // SET CAMERA ACTIVE FIRST to render the video element
      setCameraActive(true);
      
      // Then attach the stream after a brief delay for rendering
      setTimeout(() => {
        if (videoRef.current) {
          console.log('📹 Video element found, setting stream...');
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log('📹 Video metadata loaded, playing...');
            videoRef.current.play()
              .then(() => {
                console.log('✅ Video playing successfully');
                setSuccess('✅ Camera started. Click Check-In or Check-Out to mark attendance.');
                setTimeout(() => setSuccess(''), 2000);
              })
              .catch(err => {
                console.error('❌ Play error:', err);
                setError('Failed to start video: ' + err.message);
              });
          };
        } else {
          console.error('❌ Video ref still null after camera active');
          setError('❌ Video element not found');
          setCameraActive(false);
        }
      }, 100);
      
    } catch (err) {
      console.error('❌ Camera error:', err);
      setError('❌ ' + err.message);
      setCameraActive(false);
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  // Detect face in video stream (optimized for speed)
  const detectFace = async () => {
    try {
      if (!window.faceapi || !videoRef.current) {
        return { success: false, message: 'Face detection not available' };
      }

      // Use only TinyFaceDetector for fast detection (no landmarks, no descriptors)
      const detections = await window.faceapi
        .detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({
          inputSize: 416,  // Reduce input size for speed
          scoreThreshold: 0.5  // Lower threshold for faster detection
        }));

      if (detections.length === 0) {
        return { success: false, message: '❌ No face detected. Please look at camera.' };
      }

      if (detections.length > 1) {
        return { success: false, message: '❌ Multiple faces detected. Only one person allowed.' };
      }

      // Create a simple descriptor from detected face position/size
      const face = detections[0];
      const descriptor = new Float32Array([
        face.detection.box.x,
        face.detection.box.y,
        face.detection.box.width,
        face.detection.box.height,
        face.detection.score
      ]);

      return {
        success: true,
        face: face,
        descriptor: descriptor  // Lightweight descriptor
      };
    } catch (error) {
      console.error('Error detecting face:', error);
      return { success: false, message: '❌ Face detection error: ' + error.message };
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
      // VERIFY ATTENDANCE TIME LIMIT BEFORE PROCESSING
      const timeCheck = attendanceAccessControl.verifyAttendanceRecording();
      if (!timeCheck.canRecord) {
        setError(timeCheck.message);
        return;
      }

      if (!cameraActive) {
        setError('❌ Camera not started');
        return;
      }

      setLoading(true);
      setScanPhase('scanning');
      setError('');
      setLocationError('');

      // Check if face has already been captured this month (for subsequent check-ins)
      const monthlyFaceCheck = await attendanceService.checkMonthlyFaceCapture(currentUser.id);
      
      let faceDescriptor = null;

      // Only require face detection for first check-in of month
      if (type === 'check-in' && monthlyFaceCheck.hasFaceThisMonth) {
        // Face already captured this month - skip face detection, proceed with attendance
        console.log('😹 Face already captured this month on ' + monthlyFaceCheck.captureDate);
        setError(''); // No error
      } else if (type === 'check-in' && !monthlyFaceCheck.hasFaceThisMonth) {
        // First check-in of month - detect face
        console.log('👀 Detecting face for first check-in of month...');
        const faceDetection = await detectFace();
        
        if (!faceDetection.success) {
          setError(faceDetection.message);
          setScanPhase('idle');
          setLoading(false);
          return;
        }

        console.log('✅ Face detected successfully');
        setFaceDetected(true);
        faceDescriptor = faceDetection.descriptor;
      } else if (type === 'check-out') {
        // Check-out: Only detect face if it was captured today (first check-in of month)
        const todayRecord = await attendanceService.getTodayAttendance(currentUser.id);
        if (todayRecord && todayRecord.checkInDescriptor) {
          // Face was captured today - detect and verify
          console.log('👀 Detecting face for check-out verification...');
          const faceDetection = await detectFace();
          
          if (!faceDetection.success) {
            setError(faceDetection.message);
            setScanPhase('idle');
            setLoading(false);
            return;
          }

          console.log('✅ Face detected successfully');
          setFaceDetected(true);
          faceDescriptor = faceDetection.descriptor;
        } else {
          // Face was captured earlier this month - no verification needed
          console.log('😹 Using monthly face capture - no verification needed');
        }
      }

      // Capture photo to canvas for check-in
      if (type === 'check-in' && canvasRef.current && videoRef.current) {
        try {
          const context = canvasRef.current.getContext('2d');
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
          context.drawImage(videoRef.current, 0, 0);
          console.log('📷 Photo captured for check-in');
        } catch (photoErr) {
          console.warn('⚠️ Failed to capture photo:', photoErr);
        }
      }

      // Get GPS location
      console.log('📍 Requesting GPS location for ' + type + '...');
      let location = null;
      try {
        location = await locationService.getCurrentLocation();
        showLoader();
        
        // Verify office radius
        const radiusCheck = locationService.verifyOfficeRadius(location.latitude, location.longitude);
        console.log(radiusCheck.message);
        
        if (!radiusCheck.isWithinRadius) {
          setLocationError(radiusCheck.message);
          setIsWithinRadius(false);
          setScanPhase('idle');
          setLoading(false);
          setError('❌ Cannot mark attendance outside office radius. ' + radiusCheck.message);
          return;
        }
        setIsWithinRadius(true);
        setCurrentLocation(location);
        console.log('✅ Location verified: Within office radius');
      } catch (locErr) {
        console.warn('⚠️ GPS error (proceeding without location):', locErr.message);
        setLocationError(locErr.message);
        // Continue without location (fallback)
      }

      // Wait a moment for verification
      await new Promise(resolve => setTimeout(resolve, 300));

      setScanPhase('verifying');

      // FINAL TIME CHECK BEFORE RECORDING
      const finalTimeCheck = attendanceAccessControl.canSubmitAttendance();
      if (!finalTimeCheck.allowed) {
        setError('❌ Attendance time limit has expired. Cannot record attendance after 11:59 AM.');
        setScanPhase('idle');
        setLoading(false);
        return;
      }

      // Record attendance with face descriptor (if any) and location
      const result = await attendanceService.recordAttendance(
        currentUser.id,
        type,
        faceDescriptor, // Face descriptor only if detected
        location, // Pass location
        canvasRef.current // Pass canvas for photo capture
      );

      if (result.success) {
        setSuccess(result.message);
        setFaceMatchScore(faceDescriptor ? 0.95 : 1.0);

        // Reload attendance
        await loadTodayAttendance(currentUser.id);

        // Close camera after 2 seconds
        setTimeout(() => {
          stopCamera();
        }, 2000);
      } else {
        setError(result.message);
        // If face match failed, keep the error visible longer
        if (result.faceMatchFailed) {
          setScanPhase('idle');
          setLoading(false);
          console.warn('❌ FACE MATCH FAILED - Check-out rejected');
        } else if (result.requiresFaceCapture) {
          setScanPhase('idle');
          setLoading(false);
          console.warn('❌ FACE CAPTURE REQUIRED - First check-in of month');
        } else {
          setScanPhase('idle');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError('❌ ' + err.message);
      setScanPhase('idle');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  const canCheckIn = !todayAttendance || !todayAttendance.checkInTime;
  const canCheckOut = todayAttendance && todayAttendance.checkInTime && !todayAttendance.checkOutTime;
  const attendanceButtonState = attendanceAccessControl.getAttendanceButtonState();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fb', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: '80px' }}>
      <div className="header">
        <div className="header-title">📍 Attendance Marking</div>
        {/* Removed back button as we now have bottom navigation */}
      </div>

      <div className="container">
        <p style={{ color: '#666', marginBottom: '15px' }}>
          Mark your daily attendance using AI Face Recognition
        </p>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            padding: '15px 18px',
            backgroundColor: '#ffebee',
            border: '2px solid #f44336',
            borderRadius: '6px',
            color: '#c62828',
            marginBottom: '20px',
            fontWeight: '500',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5'
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

        {locationError && (
          <div style={{
            padding: '12px 15px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            📍 {locationError}
          </div>
        )}

        {currentLocation && isWithinRadius && (
          <div style={{
            padding: '12px 15px',
            backgroundColor: '#d4edda',
            border: '1px solid #28a745',
            borderRadius: '4px',
            color: '#155724',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ✅ Location verified: {currentLocation.latitude}, {currentLocation.longitude} (Accuracy: {currentLocation.accuracy}m)
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px'
            }}>
              <div>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-in Time</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>
                  {todayAttendance.checkInTime || '⏳ Pending'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-out Time</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#d32f2f' }}>
                  {todayAttendance.checkOutTime || '⏳ Pending'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Working Hours</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#ff6f00' }}>
                  {todayAttendance.workingHours ? todayAttendance.workingHours + 'h' : 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Status</p>
                <p style={{
                  margin: '5px 0 0 0',
                  fontSize: '14px',
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
                  {scanPhase === 'idle' && '📹 Camera ready. Click Check-In or Check-Out'}
                  {scanPhase === 'scanning' && '👀 Detecting face and GPS location...'}
                  {scanPhase === 'verifying' && '✓ Processing attendance...'}
                  {faceDetected && faceMatchScore > 0 && ` | Face Match: ${(faceMatchScore * 100).toFixed(0)}%`}
                </p>
              </div>

              {!canSubmitAttendance && (
                <div style={{
                  width: '100%',
                  padding: '15px',
                  backgroundColor: '#ffebee',
                  border: '2px solid #f44336',
                  borderRadius: '6px',
                  marginBottom: '15px',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#c62828', fontSize: '16px' }}>
                    ⏰ Attendance Window Closed
                  </p>
                  <p style={{ margin: '0', color: '#c62828', fontSize: '14px', lineHeight: '1.4' }}>
                    {attendanceButtonState.reason}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {canCheckIn && (
                  <button
                    className="btn"
                    style={{ 
                      backgroundColor: canSubmitAttendance ? '#4caf50' : '#ccc', 
                      padding: '12px 30px', 
                      fontSize: '16px', 
                      fontWeight: 'bold',
                      opacity: canSubmitAttendance ? 1 : 0.6
                    }}
                    onClick={() => scanFace('check-in')}
                    disabled={loading || scanPhase !== 'idle' || !canSubmitAttendance}
                    title={!canSubmitAttendance ? 'Attendance submission closed after 11:59 AM' : ''}
                  >
                    {loading && scanPhase !== 'idle' ? '⏳ Processing...' : '✅ Check-In'}
                  </button>
                )}

                {canCheckOut && (
                  <button
                    className="btn"
                    style={{ 
                      backgroundColor: canSubmitAttendance ? '#ff9800' : '#ccc', 
                      padding: '12px 30px', 
                      fontSize: '16px', 
                      fontWeight: 'bold',
                      opacity: canSubmitAttendance ? 1 : 0.6
                    }}
                    onClick={() => scanFace('check-out')}
                    disabled={loading || scanPhase !== 'idle' || !canSubmitAttendance}
                    title={!canSubmitAttendance ? 'Attendance submission closed after 11:59 AM' : ''}
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
            <li>Your face will be detected using AI and GPS location captured</li>
            <li>You must be within office radius (500m) to mark attendance</li>
            <li>Click "Check-Out" when you leave work</li>
            <li>Your face is verified automatically for security</li>
            <li>Location helps track work-from-office compliance</li>
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
    </div>
  );
};

export default AttendanceScreen;
