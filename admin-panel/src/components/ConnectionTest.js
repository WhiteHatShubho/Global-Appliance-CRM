import React, { useState, useEffect } from 'react';
import { app, auth, db } from '../firebase';
import { testFirebaseConnection, testFirebaseRead } from '../firebase-test';

const ConnectionTest = () => {
  const [testResults, setTestResults] = useState({
    status: 'not_started',
    messages: []
  });

  const addMessage = (message) => {
    setTestResults(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  };

  const runTests = async () => {
    setTestResults({
      status: 'running',
      messages: ['Starting connection tests...']
    });

    try {
      addMessage('Testing Firebase app initialization...');
      if (!app) {
        addMessage('❌ Firebase app not initialized');
        setTestResults(prev => ({ ...prev, status: 'failed' }));
        return;
      }
      addMessage('✅ Firebase app initialized');

      addMessage('Testing Firebase auth...');
      if (!auth) {
        addMessage('❌ Firebase auth not initialized');
        setTestResults(prev => ({ ...prev, status: 'failed' }));
        return;
      }
      addMessage('✅ Firebase auth initialized');

      addMessage('Testing Firebase database...');
      if (!db) {
        addMessage('❌ Firebase database not initialized');
        setTestResults(prev => ({ ...prev, status: 'failed' }));
        return;
      }
      addMessage('✅ Firebase database initialized');

      addMessage('Testing database connection...');
      const connectionResult = await testFirebaseConnection();
      if (connectionResult) {
        addMessage('✅ Database connection successful');
      } else {
        addMessage('❌ Database connection failed');
        setTestResults(prev => ({ ...prev, status: 'failed' }));
        return;
      }

      addMessage('Testing database read...');
      await testFirebaseRead();
      addMessage('✅ Database read test completed');

      setTestResults(prev => ({ ...prev, status: 'success' }));
      addMessage('🎉 All tests passed!');

    } catch (error) {
      addMessage(`❌ Test failed with error: ${error.message}`);
      setTestResults(prev => ({ ...prev, status: 'failed' }));
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Firebase Connection Test</h1>
      
      <div style={{ 
        padding: '15px', 
        borderRadius: '5px',
        marginBottom: '20px',
        backgroundColor: 
          testResults.status === 'success' ? '#d4edda' :
          testResults.status === 'failed' ? '#f8d7da' :
          testResults.status === 'running' ? '#fff3cd' : '#f8f9fa',
        color: 
          testResults.status === 'success' ? '#155724' :
          testResults.status === 'failed' ? '#721c24' :
          testResults.status === 'running' ? '#856404' : '#383d41'
      }}>
        <strong>Status: </strong>
        {testResults.status === 'not_started' && 'Not Started'}
        {testResults.status === 'running' && 'Running Tests...'}
        {testResults.status === 'success' && 'All Tests Passed!'}
        {testResults.status === 'failed' && 'Tests Failed'}
      </div>

      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '15px', 
        borderRadius: '5px',
        fontFamily: 'monospace',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {testResults.messages.map((message, index) => (
          <div key={index} style={{ marginBottom: '5px' }}>
            {message}
          </div>
        ))}
      </div>

      <button 
        onClick={runTests}
        style={{ 
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Run Tests Again
      </button>
    </div>
  );
};

export default ConnectionTest;