import { getDatabase, ref, get } from 'firebase/database';

class JobNotificationService {
  /**
   * Send FCM push notification to a technician when a job is assigned
   * This function should be called from the admin panel when creating/assigning a job
   */
  static async sendJobNotificationToTechnician(technicianId, jobData) {
    try {
      const database = getDatabase();
      
      // Get technician's FCM token from database
      const technicianRef = ref(database, `technicians/${technicianId}/fcmToken`);
      const snapshot = await get(technicianRef);
      
      if (!snapshot.exists()) {
        console.warn('⚠️ Technician has no FCM token registered:', technicianId);
        return false;
      }

      const fcmData = snapshot.val();
      const fcmToken = fcmData.token;

      if (!fcmToken) {
        console.warn('⚠️ FCM token is empty for technician:', technicianId);
        return false;
      }

      // Call Firebase Cloud Function to send the message
      // Note: This requires a deployed Firebase Cloud Function
      const response = await fetch('/api/sendJobNotification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fcmToken: fcmToken,
          jobData: jobData,
          technicianId: technicianId,
          title: '🚨 NEW JOB ALERT!',
          body: `New job: ${jobData.title || 'Service required'} for customer: ${jobData.customerName || 'Unknown'}`,
          jobCode: jobData.ticketCode || jobData.id?.substring(0, 4) || 'JOB',
          priority: 'high'
        })
      });

      if (response.ok) {
        console.log('✅ Job notification sent to technician:', technicianId);
        return true;
      } else {
        console.error('❌ Failed to send job notification:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error sending job notification:', error);
      return false;
    }
  }

  /**
   * Send push notification to multiple technicians
   */
  static async sendJobNotificationToMultipleTechnicians(technicianIds, jobData) {
    try {
      const results = await Promise.all(
        technicianIds.map(technicianId =>
          this.sendJobNotificationToTechnician(technicianId, jobData)
        )
      );

      const successCount = results.filter(r => r === true).length;
      console.log(`✅ Sent job notifications to ${successCount}/${technicianIds.length} technicians`);
      
      return successCount > 0;
    } catch (error) {
      console.error('Error sending notifications to multiple technicians:', error);
      return false;
    }
  }

  /**
   * Send immediate FCM notification (for urgent jobs)
   */
  static async sendUrgentJobNotification(technicianId, jobData) {
    try {
      // Same as sendJobNotification but with priority: 'high'
      return await this.sendJobNotificationToTechnician(technicianId, {
        ...jobData,
        priority: 'high',
        urgency: true
      });
    } catch (error) {
      console.error('Error sending urgent notification:', error);
      return false;
    }
  }
}

export default JobNotificationService;
