import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNavigation.css';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);

  const navItems = [
    { label: 'Jobs', icon: '📋', path: '/today-jobs' },
    { label: 'Completed', icon: '✅', path: '/completed-jobs' },
    { label: 'Attendance', icon: '📍', path: '/attendance' },
    { label: 'Tickets', icon: '💬', path: '/tickets' },
    { label: 'Profile', icon: '⚙️', path: '/profile' }
  ];

  // Set active index based on current path
  useEffect(() => {
    const currentIndex = navItems.findIndex(item => item.path === location.pathname);
    if (currentIndex !== -1) {
      setActiveIndex(currentIndex);
    }
  }, [location.pathname]);

  const handleNavClick = (index, path) => {
    setActiveIndex(index);
    navigate(path);
  };

  return (
    <div className="bottom-nav-wrapper">
      <nav className="bottom-nav">
        <div className="indicator" style={{ '--x': `${(activeIndex / navItems.length) * 100}%` }}>
          <span className="indicator-icon">{navItems[activeIndex].icon}</span>
        </div>

        <ul className="nav-items">
          {navItems.map((item, index) => (
            <li key={index} className={activeIndex === index ? 'active' : ''}>
              <button
                type="button"
                onClick={() => handleNavClick(index, item.path)}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default BottomNavigation;
