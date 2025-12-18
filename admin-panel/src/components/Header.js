import React from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import { useSidebar } from '../context/SidebarContext';

const Header = () => {
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  const handleLogout = () => {
    // Clear session
    sessionManager.clearSession();
    // Remove admin status from localStorage
    localStorage.removeItem('isAdmin');
    // Redirect to login page
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', minWidth: '0', gap: '15px', flex: 1 }}>
        <button 
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Toggle Sidebar"
        >
          ☰
        </button>
        <img src="/logo.svg?v=2" alt="Global Appliance Logo" style={{ height: '55px', width: 'auto', flexShrink: 0 }} />
        <div>
          <div className="header-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0', fontSize: '1.1rem' }}>GLOBAL APPLIANCE</div>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0', fontSize: '0.8rem', opacity: 0.9 }}>Water Purifier & Chimney Service</div>
        </div>
      </div>
      <div className="user-info">
        <span>Admin User</span>
        <button className="btn" style={{ width: 'auto' }} onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
};

export default Header;