// Firebase configuration test
import { app, db } from './firebase';
import { ref, set, get, child } from 'firebase/database';

// Test function to verify Firebase connection
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    
    // Log Firebase app info
    console.log('Firebase app initialized:', app && app.name);
    console.log('Firebase database initialized:', !!db);
    console.log('Database URL:', db?.app?.options?.databaseURL);
    
    // Test 1: Try to read existing data instead of writing
    console.log('Attempting to read from database...');
    try {
      const snapshot = await get(child(ref(db), 'test'));
      console.log('Read test successful. Data exists:', snapshot.exists());
    } catch (readError) {
      console.log('Read test returned error (may be expected if no data):', readError.code);
    }
    
    // Test 2: Try to write test data with shorter timeout
    console.log('Attempting to write test data...');
    const testRef = ref(db, 'test/connection');
    await set(testRef, {
      timestamp: new Date().toISOString(),
      status: 'connected'
    });
    
    console.log('Firebase connection successful!');
    return true;
  } catch (error) {
    console.error('Firebase connection failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // Check specific error conditions
    if (error.code === 'PERMISSION_DENIED') {
      console.error('PERMISSION DENIED: Check your Firebase Realtime Database rules');
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('NETWORK ERROR: Check internet connection and Firebase configuration');
    } else if (error.message?.includes('Cannot parse url')) {
      console.error('CONFIGURATION ERROR: Invalid database URL in firebase.js');
    }
    
    return false;
  }
};

// Test function to read data
export const testFirebaseRead = async () => {
  try {
    const testRef = ref(db, 'test/connection');
    const snapshot = await get(child(testRef, '/'));
    const data = snapshot.val();
    console.log('Read from Firebase:', data);
    return true;
  } catch (error) {
    console.error('Firebase read failed:', error);
    return false;
  }
};

export default { testFirebaseConnection, testFirebaseRead };

const testFunctions = { testFirebaseConnection, testFirebaseRead };
export { testFunctions };