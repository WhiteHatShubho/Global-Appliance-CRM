import { getDatabase, ref, get } from 'firebase/database';
import sessionManager from './sessionManager';

class AttendanceReminderService {
  constructor() {
    this.reminderScheduled = false;
    this.techniciansMap = {};
  }

  /**
   * Initialize daily 11 AM attendance reminder
   */
  initializeDailyReminder() {
    if (this.reminderScheduled) return;

    this.scheduleDaily11AMReminder();
    this.reminderScheduled = true;
    console.log('✅ Attendance reminder scheduled for 11 AM daily');
  }

  /**
   * Schedule reminder for 11 AM every day
   */
  scheduleDaily11AMReminder() {
    const checkAndRemind = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Check if it's 11:00 AM (within 1 minute window)
      if (currentHour === 11 && (currentMinute === 0 || currentMinute === 1)) {
        console.log('🕐 11 AM attendance reminder check triggered');
        await this.checkAndSendReminder();
      }
    };

    // Check every minute (more reliable for Android APK)
    setInterval(checkAndRemind, 60000);

    // Also check immediately on app load
    setTimeout(checkAndRemind, 1000);
    
    // Check every 30 seconds in case user opens app near 11 AM
    setInterval(checkAndRemind, 30000);
  }

  /**
   * Check if technician has given attendance today
   * If not, send reminder notification
   * Works in Android APK with Capacitor Local Notifications
   */
  checkAndSendReminder = async () => {
    try {
      const technicianId = sessionManager.getTechnicianId();
      if (!technicianId) {
        console.log('⚠️ No technician ID found for attendance reminder');
        return;
      }

      const database = getDatabase();
      const attendanceRef = ref(database, `attendance/${technicianId}`);
      const snapshot = await get(attendanceRef);
      const attendanceData = snapshot.val() || {};

      // Get today's date (YYYY-MM-DD format)
      const today = new Date().toISOString().split('T')[0];
      console.log(`🔍 Checking attendance for: ${technicianId} on ${today}`);

      // Check if attendance already marked for today
      const todayAttendance = Object.values(attendanceData).find(record => {
        if (record && record.timestamp) {
          const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
          return recordDate === today;
        }
        return false;
      });

      if (!todayAttendance) {
        // No attendance marked - send reminder
        console.log('📢 Sending attendance reminder - no attendance marked yet');
        await this.sendAttendanceReminder();
      } else {
        console.log('✅ Attendance already marked for today - no reminder sent');
      }
    } catch (error) {
      console.error('❌ Error checking attendance:', error);
    }
  };

  /**
   * Send attendance reminder notification with sound
   * Works in Android APK with Capacitor Local Notifications
   */
  async sendAttendanceReminder() {
    const technicianName = sessionManager.getTechnicianName();
    const title = '📍 Mark Attendance';
    const body = 'Please mark your attendance for today in Global Appliance Tech app.';

    console.log('🔔 Sending attendance reminder notification');

    // Try Capacitor Local Notifications first (for Android APK)
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        const { LocalNotifications } = window.Capacitor.Plugins;
        
        await LocalNotifications.schedule({
          notifications: [
            {
              title: title,
              body: body,
              id: Math.floor(Math.random() * 10000),
              autoCancel: true,
              smallIcon: 'res://launcher_foreground',
              iconColor: '#FF6B35',
              vibrate: [200, 100, 200, 100, 200],
              sound: 'default'
            }
          ]
        });
        
        console.log('✅ Attendance reminder sent via Capacitor Local Notifications');
        this.playReminderSound();
        return;
      }
    } catch (error) {
      console.warn('⚠️ Capacitor Local Notifications not available:', error);
    }

    // Fallback to Web Notification API
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const options = {
          body: body,
          icon: '/logo.svg',
          badge: '/logo.svg',
          tag: 'attendance-reminder',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          data: {
            type: 'attendance-reminder',
            timestamp: new Date().toISOString()
          }
        };

        const notification = new Notification(title, options);

        // Play beep sound
        this.playReminderSound();

        // Handle notification click - open attendance screen
        notification.onclick = () => {
          window.location.href = '/attendance';
          notification.close();
        };
        
        console.log('✅ Attendance reminder sent via Web Notification API');
      }
    } catch (error) {
      console.warn('⚠️ Web Notification failed:', error);
    }
  }

  /**
   * Play beep sound using Web Audio API
   * Similar to job notification alerts
   */
  playReminderSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a different tone pattern for reminder (less urgent)
      const frequencies = [600, 800, 600]; // Lower frequency for reminder
      const duration = 0.2; // 200ms beeps
      const pause = 0.1; // 100ms pause between beeps
      let time = audioContext.currentTime;

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

        oscillator.start(time);
        oscillator.stop(time + duration);

        time += duration + pause;
      });

      // Repeat pattern 5 times for reminder (less intrusive than job alert)
      for (let i = 0; i < 4; i++) {
        frequencies.forEach((freq) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = freq;
          gainNode.gain.setValueAtTime(0.3, time);
          gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

          oscillator.start(time);
          oscillator.stop(time + duration);

          time += duration + pause;
        });
      }

      console.log('🔔 Attendance reminder sound played');
    } catch (error) {
      console.warn('Could not play reminder sound:', error);
    }
  }

  /**
   * Stop reminder (when user marks attendance)
   */
  stopReminder() {
    // Clear any pending notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.getNotifications({ tag: 'attendance-reminder' }).then(notifications => {
            notifications.forEach(notification => notification.close());
          });
        });
      });
    }
  }
}

const attendanceReminderService = new AttendanceReminderService();
export default attendanceReminderService;
