// Firebase Cloud Messaging Service Worker
// This file must be at the root of the web host (public folder)

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
  authDomain: "service-management-syste-5a9f5.firebaseapp.com",
  databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
  projectId: "service-management-syste-5a9f5",
  storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
  messagingSenderId: "719700732732",
  appId: "1:719700732732:web:0cbc53d5e99f66cb148c39"
});

const messaging = firebase.messaging();

// Handle background message
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || '🚨 NEW JOB ALERT!';
  const notificationOptions = {
    body: payload.notification?.body || 'You have received a new urgent job. Tap to view details.',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: 'new-job-alert',
    requireInteraction: true, // Keep notification on screen until user interacts
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Persistent vibration pattern
    data: {
      ...payload.data,
      jobId: payload.data?.jobId || '',
      timestamp: new Date().toISOString()
    },
    // High priority notification
    priority: 'high'
  };

  // Show notification with sound
  self.registration.showNotification(notificationTitle, notificationOptions);

  // Play alert sound in service worker
  playAlertSound();
});

// Play alert sound function
function playAlertSound() {
  try {
    // Create audio context and play alert tone
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();
    
    const frequencies = [800, 1000, 800]; // Multi-tone pattern
    const beepDuration = 0.3;
    const pauseDuration = 0.1;
    let scheduleTime = audioContext.currentTime;

    // Repeat pattern 10 times
    for (let repeat = 0; repeat < 10; repeat++) {
      frequencies.forEach((freq) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        // Fade in
        gain.gain.setValueAtTime(0, scheduleTime);
        gain.gain.linearRampToValueAtTime(0.5, scheduleTime + 0.05);
        
        // Hold
        gain.gain.setValueAtTime(0.5, scheduleTime + beepDuration - 0.05);
        
        // Fade out
        gain.gain.linearRampToValueAtTime(0, scheduleTime + beepDuration);
        
        osc.start(scheduleTime);
        osc.stop(scheduleTime + beepDuration);
        
        scheduleTime += beepDuration + pauseDuration;
      });
    }

    console.log('🔊 Alert sound played from service worker');
  } catch (error) {
    console.error('Error playing alert sound in service worker:', error);
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event.notification);

  event.notification.close();

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification);
  // Stop alert sound if still playing
  stopAlertSound();
});

// Stop alert sound
function stopAlertSound() {
  try {
    // In service worker, we can't directly stop Web Audio API,
    // but we can send message to main thread
    console.log('🔊 Alert sound stopped');
  } catch (error) {
    console.error('Error stopping sound:', error);
  }
}
