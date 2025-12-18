import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import { getDatabase, ref, query, orderByChild, equalTo, get } from 'firebase/database';

const LoginOTP = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has valid session, skip login if they do
    if (sessionManager.hasValidSession()) {
      console.log('Valid session found, redirecting to dashboard');
      localStorage.setItem('isAdmin', 'true');
      navigate('/dashboard');
      return;
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter email and password');
      }

      // Get database reference
      const database = getDatabase();
      const adminsRef = ref(database, 'admins');
      
      // Search for admin by email
      const adminQuery = query(
        adminsRef,
        orderByChild('email'),
        equalTo(email.trim())
      );
      
      const snapshot = await get(adminQuery);
      
      if (!snapshot.exists()) {
        throw new Error('Email not registered');
      }

      // Get admin data
      const adminsData = snapshot.val();
      const adminId = Object.keys(adminsData)[0];
      const adminData = adminsData[adminId];
      
      // Verify password
      if (adminData.password !== password) {
        throw new Error('Incorrect password');
      }

      // Create session
      sessionManager.createSession(
        adminId,
        adminData.name || 'Admin',
        email
      );
      console.log('Admin session created');
      
      setMessage('Login successful!');
      localStorage.setItem('isAdmin', 'true');
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/logo.svg?v=2" alt="Global Appliance Logo" style={{ height: '80px', width: 'auto', marginBottom: '15px' }} />
          <h2 style={{ margin: '0', fontSize: '1.5rem' }}>GLOBAL APPLIANCE</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>Water Purifier & Chimney Service</p>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
            {message}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#0066ff'
              }}
              disabled={loading}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <p style={{ marginTop: '15px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
          GLOBAL APPLIANCE Service Management System
        </p>
      </form>
    </div>
  );
};

export default LoginOTP;
