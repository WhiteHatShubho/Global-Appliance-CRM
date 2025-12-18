import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ExpandingMenu = () => {
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState(null);

  useEffect(() => {
    // Load profile picture from localStorage
    const savedProfile = localStorage.getItem('technicianProfile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.profilePicture) {
          setProfilePicture(parsed.profilePicture);
        }
      } catch (error) {
        console.log('Error loading profile:', error);
      }
    }

    // Listen for storage changes to update profile picture in real-time
    const handleStorageChange = () => {
      const updated = localStorage.getItem('technicianProfile');
      if (updated) {
        try {
          const parsed = JSON.parse(updated);
          setProfilePicture(parsed.profilePicture || null);
        } catch (error) {
          console.log('Error loading profile:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const menuItems = [
    { id: 'jobs', title: 'Today\'s Jobs', icon: '📋', path: '/today-jobs' },
    { id: 'completed', title: 'Completed', icon: '✅', path: '/completed-jobs' },
    { id: 'attendance-mark', title: 'Mark Attendance', icon: '📍', path: '/attendance' },
    { id: 'attendance-history', title: 'Attendance History', icon: '📅', path: '/attendance-history' },
    { id: 'payroll', title: 'Payroll', icon: '💰', path: '/payroll' },
    { id: 'profile', title: 'Profile', icon: '👤', path: '/profile' },
    { id: 'logout', title: 'Logout', icon: '🚪', path: '/login' }
  ];

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #dde8f3;
          --menu-bg: rgba(255, 255, 255, 0.7);
          --border: rgba(0, 0, 0, 0.06);
          --accent: #2563eb;
          --text: #111827;
          --muted: #6b7280;
          --radius: 16px;
          --transition: 0.3s ease;
        }

        .expanding-menu {
          padding: 1rem;
          background: var(--menu-bg);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          display: flex;
          gap: 14px;
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
        }

        .menu-link {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 60px;
          height: 50px;
          border-radius: var(--radius);
          color: var(--muted);
          text-decoration: none;
          font-weight: 500;
          position: relative;
          overflow: hidden;
          transition: all var(--transition);
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: "Outfit", sans-serif;
        }

        .menu-link:hover,
        .menu-link:focus-visible {
          width: 60px;
          color: var(--accent);
          background: transparent;
          box-shadow: none;
          outline: none;
        }

        .link-icon {
          font-size: 28px;
          flex-shrink: 0;
          transition: transform var(--transition), filter var(--transition);
        }

        .link-icon-image {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid var(--accent);
          transition: transform var(--transition), filter var(--transition);
        }

        .menu-link:hover .link-icon,
        .menu-link:focus-visible .link-icon {
          transform: scale(1.2) rotate(5deg);
          filter: brightness(1.3);
        }

        .link-title {
          display: none;
        }
      `}</style>

      <nav className="expanding-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="menu-link"
            onClick={() => handleNavigate(item.path)}
            title={item.title}
          >
            {item.id === 'profile' && profilePicture ? (
              <img src={profilePicture} alt="Profile" className="link-icon-image" />
            ) : (
              <span className="link-icon">{item.icon}</span>
            )}
            <span className="link-title">{item.title}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default ExpandingMenu;
