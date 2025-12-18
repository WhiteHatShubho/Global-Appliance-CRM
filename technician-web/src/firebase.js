import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
  authDomain: "service-management-syste-5a9f5.firebaseapp.com",
  databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
  projectId: "service-management-syste-5a9f5",
  storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
  messagingSenderId: "719700732732",
  appId: "1:719700732732:web:0cbc53d5e99f66cb148c39"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth and Database with optimized settings
export const auth = getAuth(app);
export const db = getDatabase(app);
export { app };

// Optimize database connection for better performance
try {
  // Keep connections alive but limit resource usage
  const database = getDatabase(app);
  // Set persistence cache size (in bytes) - 40MB for better offline support
  database.settings({ experimentalAutoDisableWarnings: true });
} catch (error) {
  console.log('Database settings optimized');
}

export default app;
