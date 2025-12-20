import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../firebase';
import sessionManager from '../services/sessionManager';
import auditService from '../services/auditService';
import backupService from '../services/backupService';
import { app as firebaseApp } from '../firebase';
import { showLoader, hideLoader } from '../utils/globalLoader';
import { getDatabase, ref, query, orderByChild, equalTo, get } from 'firebase/database';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lampOn, setLampOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('');
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setMessage('');
      setLoading(true);
      showLoader();
      
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user's email is authorized as admin
      const adminRef = ref(db, 'admins');
      const adminQuery = query(adminRef, orderByChild('email'), equalTo(user.email));
      const snapshot = await get(adminQuery);
      
      if (!snapshot.exists()) {
        throw new Error(`Email "${user.email}" is not registered as admin.`);
      }
      
      // Login successful
      auditService.initialize(db, user.uid, user.email);
      await auditService.logAdminLogin();
      backupService.initialize(firebaseApp);
      
      sessionManager.createSession(
        user.uid,
        user.displayName || 'Admin',
        user.email
      );
      
      const token = `${user.email}_${Date.now()}`;
      const expiry = Date.now() + 30*24*60*60*1000;
      localStorage.setItem('auth', JSON.stringify({ token, expiry, email: user.email }));
      localStorage.setItem('isAdmin', 'true');
      
      setMessageColor('lightgreen');
      setMessage('✅ Google login successful — redirecting...');
      
      setTimeout(() => {
        hideLoader();
        navigate('/dashboard');
      }, 600);
    } catch (error) {
      console.error('Google login failed:', error);
      setMessageColor('#ffb3b3');
      setMessage(`❌ ${error.message}`);
      setLoading(false);
      hideLoader();
    }
  };

      
      // For demo: just login
      const adminData = Object.values(snapshot.val())[0];
      
      auditService.initialize(db, adminData.id, adminData.email);
      await auditService.logAdminLogin();
      backupService.initialize(firebaseApp);
      
      sessionManager.createSession(
        adminData.id,
        adminData.name || 'Admin',
        adminData.email
      );
      
      const token = `${formattedPhone}_${Date.now()}`;
      const expiry = Date.now() + 30*24*60*60*1000;
      localStorage.setItem('auth', JSON.stringify({ token, expiry, email: adminData.email }));
      localStorage.setItem('isAdmin', 'true');
      
      setMessageColor('lightgreen');
      setMessage('✅ Phone login successful — redirecting...');
      
      setTimeout(() => {
        hideLoader();
        navigate('/dashboard');
      }, 600);
    } catch (error) {
      console.error('Phone login failed:', error);
      setMessageColor('#ffb3b3');
      setMessage(`❌ ${error.message}`);
      setLoading(false);
      hideLoader();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      showLoader();
      const emailTrimmed = email.trim();
      console.log('Attempting login', { emailTrimmed });
      
      const userCredential = await signInWithEmailAndPassword(auth, emailTrimmed, password);
      const user = userCredential.user;
      
      // Initialize audit service with user info
      auditService.initialize(db, user.uid, emailTrimmed);
      
      // Log the login
      await auditService.logAdminLogin();
      
      // Initialize backup service
      backupService.initialize(firebaseApp);
      
      // Create session using sessionManager
      sessionManager.createSession(
        user.uid,
        user.displayName || 'Admin User',
        emailTrimmed
      );
      
      // Also keep the auth token for backward compatibility
      const token = `${emailTrimmed}_${Date.now()}`;
      const expiry = Date.now() + 30*24*60*60*1000; // 30 days
      localStorage.setItem('auth', JSON.stringify({ token, expiry, email: emailTrimmed }));
      localStorage.setItem('isAdmin', 'true');
      
      setMessageColor('lightgreen');
      setMessage('✅ Login successful — redirecting...');
      console.log('Login successful');
      
      // Redirect to dashboard
      setTimeout(() => {
        hideLoader();
        navigate('/dashboard');
      }, 600);
    } catch (error) {
      console.error('Login failed:', error);
      setMessageColor('#ffb3b3');
      setMessage(`❌ Login failed: ${error.message}`);
      setLoading(false);
      hideLoader();
    }
  };

  const toggleLamp = () => {
    setLampOn(!lampOn);
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
  }, []);

  return (
    <div className="login-container">
      <div className={`lamp-card ${lampOn ? 'lamp-on' : ''}`} id="lampCard">
        <div className="login-title">Admin Portal</div>
        <div className="login-subtitle">Pull the cord to wake the lamp and log in ✨</div>

        <div className="lamp-box">
          <div className="lamp-scene">
            <div className="lamp-light"></div>
            <div className="lamp-shade">
              <div className="lamp-eye left"></div>
              <div className="lamp-eye right"></div>
            </div>
            <div className="lamp-cord" id="lampCord" onClick={toggleLamp}></div>
            <div className="lamp-rod"></div>
            <div className="lamp-base"></div>
          </div>
          <div className="hint-text">
            <span>Tap / pull</span> the cord to turn on the light & show the logo and login form.
          </div>
        </div>

        <div className="logo-wrap">
          <div className="company-name">Global Appliance</div>
        </div>

        <div className="login-panel">

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="pw-row">
                <div className="pw-wrap">
                  <input 
                    id="password" 
                    type="password" 
                    placeholder="Enter password" 
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
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
            {message && (
              <div
                role="status"
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  color: messageColor,
                  textAlign: 'center',
                  fontWeight: '500'
                }}
              >
                {message}
              </div>
            )}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '🔄 Signing in...' : '✅ Login'}
            </button>
            
            <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
              <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>Or login with:</p>
              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #ea4335, #fbbc05)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔴 Google Login
              </button>
            </div>
          </form>
          <p className="login-footer">
            Contact admin for account creation
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;