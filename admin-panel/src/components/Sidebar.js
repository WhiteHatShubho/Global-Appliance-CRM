import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';

const Sidebar = () => {
  const location = useLocation();
  const { isCollapsed, closeSidebar } = useSidebar();

  const getMenuClass = (path) => {
    return location.pathname === path ? 'active' : '';
  };
  
  // Close sidebar on mobile when clicking a link
  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  };
  
  // Close sidebar when clicking backdrop on mobile
  useEffect(() => {
    const handleBackdropClick = (e) => {
      if (!isCollapsed && window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.header button');
        if (sidebar && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
          closeSidebar();
        }
      }
    };
    
    document.addEventListener('click', handleBackdropClick);
    return () => document.removeEventListener('click', handleBackdropClick);
  }, [isCollapsed, closeSidebar]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {!isCollapsed && window.innerWidth <= 768 && (
        <div 
          className="sidebar-backdrop"
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            top: '70px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
      
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <ul className="sidebar-menu">
          <li>
            <Link to="/dashboard" className={getMenuClass('/dashboard')} onClick={handleLinkClick}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/customers" className={getMenuClass('/customers')} onClick={handleLinkClick}>
              Customers
            </Link>
          </li>
          <li>
            <Link to="/tickets" className={getMenuClass('/tickets')} onClick={handleLinkClick}>
              Tickets / Complaints
            </Link>
          </li>
          <li>
            <Link to="/services" className={getMenuClass('/services')} onClick={handleLinkClick}>
              🔧 Services & Maintenance
            </Link>
          </li>
          <li>
            <Link to="/amc-services" className={getMenuClass('/amc-services')} onClick={handleLinkClick}>
              🔵 AMC Services
            </Link>
          </li>
          <li>
            <Link to="/scheduling" className={getMenuClass('/scheduling')} onClick={handleLinkClick}>
              📅 Scheduling & Calendar
            </Link>
          </li>
          <li>
            <Link to="/technicians" className={getMenuClass('/technicians')} onClick={handleLinkClick}>
              Technicians
            </Link>
          </li>
          <li>
            <Link to="/attendance-dashboard" className={getMenuClass('/attendance-dashboard')} onClick={handleLinkClick}>
              📊 Attendance Reports
            </Link>
          </li>
          <li>
            <Link to="/edit-attendance" className={getMenuClass('/edit-attendance')} onClick={handleLinkClick}>
              ✏️ Edit Attendance
            </Link>
          </li>
          <li>
            <Link to="/salary-dashboard" className={getMenuClass('/salary-dashboard')} onClick={handleLinkClick}>
              💰 Salary Management
            </Link>
          </li>
          <li>
            <Link to="/payments" className={getMenuClass('/payments')} onClick={handleLinkClick}>
              Payments
            </Link>
          </li>
          <li>
            <Link to="/due-payments" className={getMenuClass('/due-payments')} onClick={handleLinkClick}>
              💰 Due Payments
            </Link>
          </li>
          <li>
            <Link to="/rent-management" className={getMenuClass('/rent-management')} onClick={handleLinkClick}>
              🏠 Rent Management
            </Link>
          </li>
          <li>
            <Link to="/reports" className={getMenuClass('/reports')} onClick={handleLinkClick}>
              Reports
            </Link>
          </li>
          <li>
            <Link to="/whatsapp-messaging" className={getMenuClass('/whatsapp-messaging')} onClick={handleLinkClick}>
              📱 WhatsApp Messaging
            </Link>
          </li>
          <li>
            <Link to="/realtime-backup" className={getMenuClass('/realtime-backup')} style={{ color: '#28a745', fontWeight: 'bold' }} onClick={handleLinkClick}>
              🔄 Realtime Backup
            </Link>
          </li>
          <li style={{ borderTop: '1px solid #ddd', marginTop: '10px', paddingTop: '10px' }}>
            <Link to="/audit-logs" className={getMenuClass('/audit-logs')} onClick={handleLinkClick}>
              📋 Audit Logs
            </Link>
          </li>
          <li>
            <Link to="/data-recovery" className={getMenuClass('/data-recovery')} onClick={handleLinkClick}>
              🗂️ Data Recovery
            </Link>
          </li>
          <li>
            <Link to="/staff-location-tracker" className={getMenuClass('/staff-location-tracker')} onClick={handleLinkClick}>
              📍 Staff Location Tracker
            </Link>
          </li>
        </ul>
      </aside>
    </>
  );
};

export default Sidebar;