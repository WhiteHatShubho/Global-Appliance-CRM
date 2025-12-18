import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Tickets from './components/Tickets';
import Scheduling from './components/Scheduling';
import Services from './components/Services';
import AMCServices from './components/AMCServices';
import Technicians from './components/Technicians';
import Payments from './components/Payments';
import DuePayments from './components/DuePayments';
import Reports from './components/Reports';
import RentManagement from './components/RentManagement';
// Attendance Marking removed - only Attendance Reports available to admin
// import Attendance from './components/Attendance';
import AttendanceDashboard from './components/AttendanceDashboard';
import AdminAttendanceEditor from './components/AdminAttendanceEditor';
import SalaryDashboard from './components/SalaryDashboard';
import WhatsAppMessaging from './components/WhatsAppMessaging';
import RealtimeBackup from './components/RealtimeBackup';
import AuditLogs from './components/AuditLogs';
import DataRecovery from './components/DataRecovery';
import StaffLocationTracker from './components/StaffLocationTracker';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import GlobalLoaderSVG from './components/GlobalLoaderSVG';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { app as firebaseApp, db as database } from './firebase';
import dataService from './services/dataService';
import sessionManager from './services/sessionManager';
import { testFirebaseConnection } from './firebase-test';
import { showLoader, hideLoader } from './utils/globalLoader';
import initializeDefaults from './initializeDefaults';
import './App.css';

// Layout wrapper component that applies sidebar state to main-content
const LayoutWrapper = ({ children }) => {
  const { isCollapsed } = useSidebar();
  return (
    <>
      <Header />
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-open'}`}>
        <Sidebar />
        {children}
      </div>
    </>
  );
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    // Check session
    const checkAuth = async () => {
      const isValid = sessionManager.hasValidSession();
      setIsAuthenticated(isValid);
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  
  useEffect(() => {
    console.log('App mounting, initializing Firebase connection');
    // Initialize data service with Firebase
    dataService.initializeFirebase(firebaseApp, database);
    
    // Initialize default accounts
    initializeDefaults();
    
    // 🔧 RUN MIGRATION: Fix tickets with invalid codes (one-time)
    const runMigration = async () => {
      try {
        console.log('🚧 Starting ticket code migration check...');
        await dataService.fixExistingTicketCodes();
      } catch (error) {
        console.error('❌ Migration error:', error);
      }
    };
    runMigration();
    
    // Test Firebase connection with timeout
    const testConnection = async () => {
      console.log('Testing Firebase connection from App');
      try {
        showLoader();
        const isConnected = await Promise.race([
          testFirebaseConnection(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          )
        ]);
        console.log('Firebase connection test result:', isConnected);
      } catch (error) {
        console.error('Firebase connection test error:', error);
        // Let the app run with or without real-time data
      } finally {
        hideLoader();
      }
    };
    
    testConnection();
  }, []);

  return (
    <SidebarProvider>
      <GlobalLoaderSVG />
      <div className="app">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          {/* Production routes only */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Dashboard />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Customers />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/tickets" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Tickets />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/services" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Services />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/amc-services" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <AMCServices />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/scheduling" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Scheduling />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/technicians" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Technicians />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/payments" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Payments />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/due-payments" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <DuePayments />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <Reports />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/rent-management" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <RentManagement />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/whatsapp-messaging" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <WhatsAppMessaging />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/attendance-dashboard" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <AttendanceDashboard />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/edit-attendance" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <AdminAttendanceEditor />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/salary-dashboard" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <SalaryDashboard />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/realtime-backup" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <RealtimeBackup />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/audit-logs" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <AuditLogs />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/data-recovery" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <DataRecovery />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/staff-location-tracker" element={
            <ProtectedRoute>
              <LayoutWrapper>
                <StaffLocationTracker />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
          {/* Demo/test endpoints removed for production */}
        </Routes>
      </div>
    </SidebarProvider>
  );
}

export default App;
