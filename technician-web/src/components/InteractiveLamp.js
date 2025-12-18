import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const InteractiveLamp = ({ lampOn, onToggle }) => {
  const containerRef = useRef(null);
  const cordRef = useRef(null);
  const proxyRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Get elements
    const cord = cordRef.current;
    const container = containerRef.current;

    // Sound effect
    const playClickSound = () => {
      const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
      audio.play().catch(() => {
        // Silent fail if audio not supported
      });
    };

    // Create proxy object for dragging
    const proxy = { x: 0, y: 0 };
    const startPos = { x: 0, y: 0 };

    // Draggable functionality
    let isDragging = false;

    const handleMouseDown = (e) => {
      isDragging = true;
      isDraggingRef.current = true;
      startPos.x = e.clientX;
      startPos.y = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      gsap.to(cord, {
        x: deltaX * 0.5,
        y: deltaY * 0.5,
        duration: 0.1,
        overwrite: 'auto'
      });
    };

    const handleMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      isDraggingRef.current = false;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Return to original position
      gsap.to(cord, {
        x: 0,
        y: 0,
        duration: 0.3,
        ease: 'back.out'
      });

      // If dragged far enough, toggle lamp
      if (distance > 30) {
        playClickSound();
        onToggle();
      }
    };

    cord.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch support for mobile
    const handleTouchStart = (e) => {
      isDragging = true;
      isDraggingRef.current = true;
      startPos.x = e.touches[0].clientX;
      startPos.y = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.touches[0].clientX - startPos.x;
      const deltaY = e.touches[0].clientY - startPos.y;

      gsap.to(cord, {
        x: deltaX * 0.5,
        y: deltaY * 0.5,
        duration: 0.1,
        overwrite: 'auto'
      });
    };

    const handleTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      isDraggingRef.current = false;

      const deltaX = e.changedTouches[0].clientX - startPos.x;
      const deltaY = e.changedTouches[0].clientY - startPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      gsap.to(cord, {
        x: 0,
        y: 0,
        duration: 0.3,
        ease: 'back.out'
      });

      if (distance > 30) {
        playClickSound();
        onToggle();
      }
    };

    cord.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    // Lamp animation when state changes
    if (lampOn) {
      gsap.to('.lamp__light', {
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out'
      });
      gsap.to('.lamp__shade', {
        scale: 1.05,
        duration: 0.5,
        ease: 'back.out'
      });
      gsap.to('.lamp__eyes', {
        fill: '#facc15',
        duration: 0.5
      });
    } else {
      gsap.to('.lamp__light', {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in'
      });
      gsap.to('.lamp__shade', {
        scale: 1,
        duration: 0.4,
        ease: 'power2.in'
      });
      gsap.to('.lamp__eyes', {
        fill: '#020617',
        duration: 0.4
      });
    }

    // Cleanup
    return () => {
      cord.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cord.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [lampOn, onToggle]);

  return (
    <div ref={containerRef} style={{
      width: '100%',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      <style>{`
        .lamp-container {
          width: 190px;
          height: 180px;
          margin: 0 auto;
          position: relative;
          user-select: none;
        }

        .lamp__light {
          position: absolute;
          top: 50px;
          left: 50%;
          width: 350px;
          height: 420px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at top, rgba(255, 230, 170, 0.55), rgba(255, 230, 170, 0.25) 40%, transparent 75%);
          opacity: 0;
          filter: blur(12px);
          pointer-events: none;
          z-index: 0;
        }

        .lamp__shade {
          position: absolute;
          top: 18px;
          left: 50%;
          width: 118px;
          height: 85px;
          transform: translateX(-50%);
          background: radial-gradient(circle at top left, #0066ff, #001a4d);
          border-radius: 70px 70px 20px 20px;
          box-shadow: 0 18px 24px rgba(0, 26, 77, 0.15);
          z-index: 2;
        }

        .lamp__eyes {
          position: absolute;
          width: 30px;
          height: 16px;
          border-bottom: 3px solid currentColor;
          border-radius: 0 0 18px 18px;
          fill: #020617;
          transition: fill 0.5s ease;
        }

        .lamp__eye-left {
          top: 40px;
          left: 24px;
        }

        .lamp__eye-right {
          top: 40px;
          right: 24px;
        }

        .lamp__cord {
          position: absolute;
          top: 88px;
          left: 50%;
          width: 3px;
          height: 70px;
          background: #6b7280;
          transform: translateX(-40px);
          border-radius: 999px;
          cursor: grab;
          transition: filter 0.3s ease;
          z-index: 3;
        }

        .lamp__cord:active {
          cursor: grabbing;
        }

        .lamp__cord-end {
          position: absolute;
          bottom: -10px;
          left: 50%;
          width: 12px;
          height: 12px;
          transform: translateX(-50%);
          background: #9ca3af;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: box-shadow 0.3s ease;
        }

        .lamp__rod {
          position: absolute;
          top: 95px;
          left: 50%;
          width: 16px;
          height: 85px;
          transform: translateX(-50%);
          background: linear-gradient(to bottom, #4b5563, #020617);
          border-radius: 999px;
          z-index: 1;
        }

        .lamp__base {
          position: absolute;
          bottom: 8px;
          left: 50%;
          width: 130px;
          height: 22px;
          transform: translateX(-50%);
          background: radial-gradient(circle at top, #4b5563, #020617);
          border-radius: 999px;
          box-shadow: 0 18px 28px rgba(0, 0, 0, 0.9);
          z-index: 1;
        }
      `}</style>

      <div className="lamp-container">
        {/* Light glow */}
        <div className="lamp__light" />

        {/* Lamp shade */}
        <div className="lamp__shade">
          {/* Eyes */}
          <div className="lamp__eyes lamp__eye-left" />
          <div className="lamp__eyes lamp__eye-right" />
        </div>

        {/* Cord */}
        <div ref={cordRef} className="lamp__cord">
          <div className="lamp__cord-end" />
        </div>

        {/* Rod */}
        <div className="lamp__rod" />

        {/* Base */}
        <div className="lamp__base" />
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#9ca3af',
        marginTop: '8px'
      }}>
        <span style={{ color: '#0066ff', fontWeight: '600' }}>Drag / pull</span> the cord to turn on the light!
      </div>
    </div>
  );
};

export default InteractiveLamp;
