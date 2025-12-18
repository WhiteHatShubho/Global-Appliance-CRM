import React, { createContext, useState, useContext, useEffect } from 'react';

const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
  // Initialize collapsed state based on screen size
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return window.innerWidth <= 768; // Start collapsed on mobile
  });

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  const closeSidebar = () => {
    setIsCollapsed(true);
  };
  
  // Auto-collapse on mobile when resizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsCollapsed(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};
