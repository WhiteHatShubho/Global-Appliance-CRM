import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import './SideMenu.css';

function SideMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    sessionManager.clearSession();
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('permissionsRequested');
    localStorage.removeItem('cameraPermissionGranted');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="side-menu">
      <a
        href="/today-jobs"
        className={`menu-link ${isActive('/today-jobs') ? 'active' : ''}`}
        title="Today's Jobs"
      >
        <span className="menu-icon">assignment</span>
        <span className="menu-title">Today's Jobs</span>
      </a>

      <a
        href="/completed-jobs"
        className={`menu-link ${isActive('/completed-jobs') ? 'active' : ''}`}
        title="Completed Jobs"
      >
        <span className="menu-icon">check_circle</span>
        <span className="menu-title">Completed</span>
      </a>

      <a
        href="/attendance"
        className={`menu-link ${isActive('/attendance') ? 'active' : ''}`}
        title="Attendance"
      >
        <span className="menu-icon">event_note</span>
        <span className="menu-title">Attendance</span>
      </a>

      <a
        href="/profile"
        className={`menu-link ${isActive('/profile') ? 'active' : ''}`}
        title="Profile"
      >
        <span className="menu-icon">person</span>
        <span className="menu-title">Profile</span>
      </a>

      <button
        onClick={handleLogout}
        className="menu-link logout-btn"
        title="Logout"
      >
        <span className="menu-icon">logout</span>
        <span className="menu-title">Logout</span>
      </button>
    </div>
  );
}

export default SideMenu;
