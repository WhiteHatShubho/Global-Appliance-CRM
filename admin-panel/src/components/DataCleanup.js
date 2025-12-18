import React, { useState, useEffect } from 'react';
import { app as firebaseApp } from '../firebase';
import { executeImmediateCleanup } from '../services/executeCleanup';

const DataCleanup = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('🗑️ Cleaning up all demo data...');

  useEffect(() => {
    const runCleanup = async () => {
      try {
        const result = await executeImmediateCleanup(firebaseApp);
        if (result.success) {
          setMessage('✅ All demo data has been successfully deleted! Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        } else {
          setMessage('❌ Error: ' + result.message);
          setLoading(false);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
        setMessage('❌ Error during cleanup: ' + error.message);
        setLoading(false);
      }
    };

    runCleanup();
  }, []);

  return (
    <div className="content">
      <h1>🗑️ Data Cleanup</h1>
      <div className="card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>
          {loading ? '⏳' : message.includes('✅') ? '✅' : '❌'}
        </div>
        <h2 style={{ marginBottom: '20px' }}>{message}</h2>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#0066ff', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#0066ff', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}></div>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#0066ff', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}></div>
          </div>
        )}
        {!loading && (
          <button className="btn" onClick={() => window.location.href = '/dashboard'} style={{ marginTop: '20px' }}>
            Go to Dashboard
          </button>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default DataCleanup;
