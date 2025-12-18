// Firebase configuration for the admin panel
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
  authDomain: "service-management-syste-5a9f5.firebaseapp.com",
  databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
  projectId: "service-management-syste-5a9f5",
  storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
  messagingSenderId: "719700732732",
  appId: "1:719700732732:web:0cbc53d5e99f66cb148c39"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

export const db = getDatabase(app);

// Export app instance for use in data service
export { app };

export default app;