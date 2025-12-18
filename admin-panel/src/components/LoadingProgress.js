import React, { useState, useEffect } from 'react';

const LoadingProgress = ({ show = true, message = 'Loading...' }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!show) return;
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        minWidth: '250px',
        pointerEvents: 'auto'
      }}>
        <div style={{
          fontSize: '24px',
          marginBottom: '15px'
        }}>
          ⏳
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '500',
          color: '#333'
        }}>
          {message}{dots}
        </div>
        <div style={{
          marginTop: '15px',
          height: '4px',
          backgroundColor: '#e0e0e0',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: '#007bff',
            borderRadius: '2px',
            width: '100%',
            animation: 'progress 2s ease-in-out infinite'
          }} />
        </div>
        <style>{`
          @keyframes progress {
            0% { width: 0%; }
            50% { width: 100%; }
            100% { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoadingProgress;
