const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function: Send push notification when a new ticket is created
 * Triggers when a new record is added to /tickets/{ticketId}
 * Sends notification to the assigned technician's device
 */
exports.sendJobNotification = functions.database
  .ref('tickets/{ticketId}')
  .onCreate(async (snapshot, context) => {
    const ticket = snapshot.val();
    const ticketId = context.params.ticketId;
    
    console.log('📋 New ticket created:', ticketId);
    console.log('Ticket data:', ticket);

    // Validate ticket data
    if (!ticket) {
      console.log('⚠️ No ticket data found');
      return null;
    }

    const technicianId = ticket.assignedToId;
    
    // Check if ticket is assigned to a technician
    if (!technicianId) {
      console.log('⚠️ Ticket not assigned to any technician');
      return null;
    }

    try {
      // Get technician's FCM token from database
      console.log(`🔍 Looking for FCM token for technician: ${technicianId}`);
      
      const tokenSnapshot = await admin.database()
        .ref(`technicians/${technicianId}/fcmToken/token`)
        .once('value');
      
      const fcmToken = tokenSnapshot.val();
      
      if (!fcmToken) {
        console.log(`⚠️ No FCM token found for technician: ${technicianId}`);
        return null;
      }

      console.log(`✅ FCM token found for technician: ${technicianId}`);
      console.log(`Token (first 30 chars): ${fcmToken.substring(0, 30)}...`);

      // Prepare notification payload
      const message = {
        token: fcmToken,
        notification: {
          title: '🚨 NEW JOB ALERT!',
          body: `New job assigned: ${ticket.title || 'Service Required'}`
        },
        webpush: {
          notification: {
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: 'new-job-alert',
            priority: 'high'
          },
          data: {
            jobId: ticketId,
            jobCode: ticket.ticketCode || ticketId.substring(0, 4),
            jobTitle: ticket.title || 'Service Required',
            customerName: ticket.customerName || 'Customer',
            customerPhone: ticket.customerPhone || '',
            address: ticket.address || '',
            click_action: '/'
          },
          fcmOptions: {
            link: '/'
          }
        }
      };

      // Send the notification
      const response = await admin.messaging().send(message);
      
      console.log('✅ Notification sent successfully!');
      console.log('Message ID:', response);
      
      // Log the notification in database for tracking
      await admin.database()
        .ref(`notifications/${technicianId}/${ticketId}`)
        .set({
          jobId: ticketId,
          jobCode: ticket.ticketCode || ticketId.substring(0, 4),
          jobTitle: ticket.title,
          customerName: ticket.customerName,
          sentAt: admin.database.ServerValue.TIMESTAMP,
          status: 'delivered',
          fcmResponse: response
        });

      return { success: true, messageId: response };

    } catch (error) {
      console.error('❌ Error sending notification:', error);
      
      // Log error in database for debugging
      await admin.database()
        .ref(`notifications/${technicianId}/${ticketId}`)
        .set({
          jobId: ticketId,
          jobCode: ticket.ticketCode || ticketId.substring(0, 4),
          jobTitle: ticket.title,
          customerName: ticket.customerName,
          sentAt: admin.database.ServerValue.TIMESTAMP,
          status: 'failed',
          error: error.message
        });

      return { success: false, error: error.message };
    }
  });

/**
 * Cloud Function: Send notification for attendance reminder
 * Can be triggered manually or via scheduled function
 */
exports.sendAttendanceReminder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { technicianId } = data;
  
  if (!technicianId) {
    throw new functions.https.HttpsError('invalid-argument', 'technicianId is required');
  }

  try {
    // Get technician's FCM token
    const tokenSnapshot = await admin.database()
      .ref(`technicians/${technicianId}/fcmToken/token`)
      .once('value');
    
    const fcmToken = tokenSnapshot.val();
    
    if (!fcmToken) {
      throw new functions.https.HttpsError('not-found', 'FCM token not found for technician');
    }

    // Get technician's name
    const nameSnapshot = await admin.database()
      .ref(`technicians/${technicianId}/name`)
      .once('value');
    
    const technicianName = nameSnapshot.val() || 'Technician';

    // Send attendance reminder notification
    const message = {
      token: fcmToken,
      notification: {
        title: '📍 Mark Attendance',
        body: 'Please mark your attendance for today in Global Appliance Tech app.'
      },
      webpush: {
        notification: {
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          icon: '/logo.svg',
          badge: '/logo.svg',
          tag: 'attendance-reminder',
          priority: 'high'
        },
        data: {
          type: 'attendance-reminder',
          techniciandId: technicianId,
          click_action: '/attendance'
        },
        fcmOptions: {
          link: '/attendance'
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    console.log(`✅ Attendance reminder sent to ${technicianName}`);
    
    return { success: true, messageId: response };

  } catch (error) {
    console.error('❌ Error sending attendance reminder:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Get technician's FCM token (for debugging)
 */
exports.getTechnicianFCMToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { technicianId } = data;
  
  if (!technicianId) {
    throw new functions.https.HttpsError('invalid-argument', 'technicianId is required');
  }

  try {
    const tokenSnapshot = await admin.database()
      .ref(`technicians/${technicianId}/fcmToken`)
      .once('value');
    
    const tokenData = tokenSnapshot.val();
    
    if (!tokenData) {
      return { found: false, message: 'No FCM token found' };
    }

    return { 
      found: true, 
      token: tokenData.token,
      updatedAt: tokenData.updatedAt,
      deviceId: tokenData.deviceId
    };

  } catch (error) {
    console.error('❌ Error fetching FCM token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
