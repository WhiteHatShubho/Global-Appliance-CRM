// Firebase Cloud Messaging Setup Instructions for Technician App

/*
================================================================================
  STEP 1: Enable Firebase Cloud Messaging in Firebase Console
================================================================================

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: "service-management-syste-5a9f5"
3. Go to "Cloud Messaging" tab
4. Enable Cloud Messaging API if not already enabled
5. Copy your Server API Key (you'll need this for sending messages)

================================================================================
  STEP 2: Generate VAPID Key for Web Push
================================================================================

1. In Firebase Console, go to Project Settings
2. Click "Cloud Messaging" tab
3. Under "Web Push Certificates", click "Generate Key Pair"
4. Copy the public key (VAPID key)
5. Update the VAPID_KEY in src/services/fcmService.js with this key

Current VAPID_KEY location:
  File: src/services/fcmService.js
  Line: this.VAPID_KEY = 'YOUR_VAPID_KEY_HERE'

================================================================================
  STEP 3: Place Service Worker in Public Folder
================================================================================

Service Worker file location: public/firebase-messaging-sw.js
This file is already created and contains:
  - Firebase initialization
  - Background message handling
  - Alert sound generation
  - Notification click handling

The file will be served at: https://your-domain/firebase-messaging-sw.js

================================================================================
  STEP 4: Update Firebase Configuration
================================================================================

The firebase-messaging-sw.js already has the Firebase config:
  - projectId: "service-management-syste-5a9f5"
  - apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI"
  - messagingSenderId: "719700732732"

No changes needed unless your Firebase project changes.

================================================================================
  STEP 5: Create Firebase Cloud Function for Sending FCM Messages
================================================================================

You need to deploy a Cloud Function to send FCM messages. Here's the template:

// functions/src/index.js

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";

admin.initializeApp();
const corsHandler = cors.default({ origin: true });

exports.sendJobNotification = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { fcmToken, jobData, technicianId, title, body, priority } = req.body;

      if (!fcmToken || !jobData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const message = {
        notification: {
          title: title || '🚨 NEW JOB ALERT!',
          body: body || 'You have received a new job assignment.',
        },
        data: {
          jobId: jobData.id || '',
          jobTitle: jobData.title || '',
          customerName: jobData.customerName || '',
          jobNumber: jobData.jobNumber || '',
          timestamp: new Date().toISOString(),
        },
        webpush: {
          headers: {
            TTL: '3600'
          },
          data: {
            jobId: jobData.id || '',
            jobTitle: jobData.title || '',
            customerName: jobData.customerName || '',
          },
          notification: {
            title: title || '🚨 NEW JOB ALERT!',
            body: body || 'You have received a new job assignment.',
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: 'new-job-alert',
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200, 100, 200],
          }
        },
        android: {
          priority: priority || 'high',
          notification: {
            title: title || '🚨 NEW JOB ALERT!',
            body: body || 'You have received a new job assignment.',
            sound: 'default',
            channelId: 'high_priority_jobs'
          }
        }
      };

      const response = await admin.messaging().send({
        token: fcmToken,
        ...message
      });

      console.log('Successfully sent message:', response);
      res.json({
        success: true,
        messageId: response,
        technicianId: technicianId
      });

    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        error: 'Failed to send notification',
        details: error.message
      });
    }
  });
});

// Deploy with: firebase deploy --only functions

================================================================================
  STEP 6: How FCM Token is Obtained
================================================================================

When a technician logs in:
1. LoginScreen.js calls: fcmService.registerServiceWorker()
2. Then calls: fcmService.getFCMTokenAndSync(technicianId)
3. This:
   a) Requests Notification permission
   b) Registers the service worker
   c) Gets the FCM token from Firebase
   d) Saves the token to database at: technicians/{technicianId}/fcmToken

Token structure in database:
{
  "fcmToken": {
    "token": "d8nQ3_M8j...",
    "updatedAt": "2024-01-15T10:30:00Z",
    "deviceId": "device_1234567890_abc123"
  }
}

================================================================================
  STEP 7: How to Send Notifications from Admin Panel
================================================================================

In any admin component where you create/assign a job:

import JobNotificationService from '../../../services/jobNotificationService';

// When assigning a job to a technician:
const jobData = {
  id: jobId,
  title: 'AC Repair',
  customerName: 'John Doe',
  jobNumber: 'JOB-2024-001'
};

await JobNotificationService.sendJobNotificationToTechnician(technicianId, jobData);

For multiple technicians:
await JobNotificationService.sendJobNotificationToMultipleTechnicians(
  [technicianId1, technicianId2],
  jobData
);

For urgent jobs:
await JobNotificationService.sendUrgentJobNotification(technicianId, jobData);

================================================================================
  STEP 8: How Notifications Work
================================================================================

APP CLOSED/MINIMIZED (Background):
1. Admin sends FCM message to technician's token
2. Service Worker (firebase-messaging-sw.js) receives it
3. Shows notification with sound
4. Sound plays (800Hz beeping pattern) for 30 seconds
5. Technician clicks notification → App opens

APP OPEN (Foreground):
1. Admin sends FCM message
2. Foreground listener in fcmService detects it
3. Shows notification with sound even though app is open
4. Sound plays and notification appears

================================================================================
  STEP 9: Testing FCM Notifications
================================================================================

Option 1: Use Firebase Console
1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Fill in notification details
4. Select target: "By token"
5. Paste technician's FCM token
6. Click "Send"

Option 2: Use curl to test your Cloud Function
curl -X POST http://localhost:5000/sendJobNotification \
  -H "Content-Type: application/json" \
  -d '{
    "fcmToken": "d8nQ3_M8j...",
    "jobData": {
      "id": "job123",
      "title": "AC Repair",
      "customerName": "John Doe"
    },
    "technicianId": "tech123"
  }'

================================================================================
  STEP 10: Browser Requirements
================================================================================

FCM Web Push requires:
✅ HTTPS (http://localhost also works for testing)
✅ Modern browser (Chrome, Firefox, Safari, Edge)
✅ Service Worker support
✅ Notification API support
✅ User permission to show notifications

Browsers that support FCM:
- Chrome 50+
- Firefox 48+
- Safari 16+ (iOS 16+)
- Edge 79+

================================================================================
  TROUBLESHOOTING
================================================================================

Issue: "FCM token not obtained"
Solution:
  1. Check if Notification permission is granted
  2. Check browser console for errors
  3. Verify VAPID_KEY is correct
  4. Check if service worker is registered

Issue: "Notifications not showing when app is closed"
Solution:
  1. Verify service worker is registered
  2. Check firebase-messaging-sw.js is in public folder
  3. Check browser notification settings
  4. Verify FCM message format is correct

Issue: "Sound not playing"
Solution:
  1. Check browser notification settings
  2. Verify system notification sound is enabled
  3. Check browser volume
  4. Try refreshing the page

Issue: "Service Worker failed to register"
Solution:
  1. Check if firebase-messaging-sw.js is in public folder
  2. Verify it's served at correct URL
  3. Check HTTPS is enabled (or localhost)
  4. Check browser console for errors

================================================================================
  FILES CREATED/MODIFIED
================================================================================

New Files:
1. public/firebase-messaging-sw.js
   - Service Worker for handling background messages
   - Plays alert sounds
   - Handles notification clicks

2. src/services/fcmService.js
   - Initializes FCM
   - Requests and stores FCM token
   - Listens for foreground messages
   - Syncs token to database

3. src/services/jobNotificationService.js
   - Helper service for sending job notifications
   - Methods for single and multiple technicians
   - Urgent notification support

Modified Files:
1. src/screens/LoginScreen.js
   - Calls fcmService.registerServiceWorker()
   - Calls fcmService.getFCMTokenAndSync()
   - Sets up foreground message listener

================================================================================
  NEXT STEPS
================================================================================

1. Update fcmService.js with your VAPID key
2. Deploy the Firebase Cloud Function
3. Test notifications in Firebase Console
4. Update admin panel to send notifications when assigning jobs
5. Test end-to-end: Admin assigns job → Notification appears on technician device

================================================================================
*/

export default {}; // This file is for documentation only
