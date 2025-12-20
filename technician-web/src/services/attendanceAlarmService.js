/**
 * Attendance Alarm Service
 * Triggers an alarm at 11 AM if attendance hasn't been marked
 */

class AttendanceAlarmService {
  constructor() {
    this.alarmInterval = null;
    this.audioContext = null;
    this.isAlarmActive = false;
    this.alarmTime = { hours: 11, minutes: 0 }; // 11 AM
  }

  /**
   * Initialize the alarm service
   */
  initialize() {
    console.log('🔔 Initializing attendance alarm service...');
    this.startAlarmCheck();
  }

  /**
   * Start checking for alarm time every minute
   */
  startAlarmCheck() {
    // Check immediately on initialization
    this.checkAndTriggerAlarm();

    // Then check every minute
    this.alarmInterval = setInterval(() => {
      this.checkAndTriggerAlarm();
    }, 60000); // Check every 60 seconds
  }

  /**
   * Check if it's 11 AM and attendance is not marked
   */
  async checkAndTriggerAlarm() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Check if current time is between 11:00 and 11:59
      if (currentHour === this.alarmTime.hours && !this.isAlarmActive) {
        // Check if attendance already marked today
        const hasMarkedAttendance = await this.checkAttendanceMarked();

        if (!hasMarkedAttendance) {
          console.log('🚨 11 AM Attendance alarm triggered!');
          this.triggerAlarm();
        } else {
          console.log('✅ Attendance already marked, no alarm needed');
        }
      }

      // Reset alarm flag after 11:59 AM
      if (currentHour > this.alarmTime.hours) {
        this.isAlarmActive = false;
      }
    } catch (error) {
      console.error('❌ Error in alarm check:', error);
    }
  }

  /**
   * Check if attendance is already marked for today
   */
  async checkAttendanceMarked() {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return false;

      // Import Firebase dynamically to avoid circular dependency
      const { db } = await import('../firebase');
      const { ref, get, child, query, orderByChild, limitToLast } = await import('firebase/database');

      const attendanceRef = ref(db, `attendance/${userId}`);
      const snapshot = await get(attendanceRef);

      if (!snapshot.exists()) return false;

      const attendanceData = snapshot.val();
      const today = new Date().toISOString().split('T')[0];

      // Check if today's attendance exists
      for (const key in attendanceData) {
        const record = attendanceData[key];
        if (record.date && record.date.includes(today)) {
          return true; // Attendance marked
        }
      }

      return false; // No attendance marked today
    } catch (error) {
      console.error('❌ Error checking attendance:', error);
      return false;
    }
  }

  /**
   * Trigger the alarm sound and notification
   */
  triggerAlarm() {
    if (this.isAlarmActive) return; // Prevent multiple triggers

    this.isAlarmActive = true;

    // Show browser notification if permitted
    this.showNotification();

    // Play alarm sound
    this.playAlarmSound();

    // Also vibrate if device supports it
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]); // Vibrate pattern
    }
  }

  /**
   * Show browser notification
   */
  showNotification() {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('⏰ Attendance Reminder', {
            body: 'Please mark your attendance for today!',
            icon: '/manifest.json',
            badge: '/favicon.ico',
            tag: 'attendance-alarm',
            requireInteraction: true, // Keep notification until user interacts
          });
        }
      }
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  /**
   * Play alarm sound using Web Audio API
   */
  playAlarmSound() {
    try {
      // Create audio context if not already created
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const duration = 3; // 3 seconds alarm

      // Create oscillator for alarm tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Alarm frequency (2000 Hz - high pitch)
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.setValueAtTime(1500, now + duration / 2);

      // Fade out
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      osc.start(now);
      osc.stop(now + duration);

      // Repeat alarm 3 times
      for (let i = 1; i < 3; i++) {
        const startTime = now + duration * i + 0.3; // Small gap between beeps
        osc.frequency.setValueAtTime(2000, startTime);
        osc.frequency.setValueAtTime(1500, startTime + duration / 2);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      }
    } catch (error) {
      console.error('❌ Error playing alarm sound:', error);
      // Fallback: use HTML5 audio if Web Audio API fails
      this.playFallbackAlarm();
    }
  }

  /**
   * Fallback alarm using HTML5 audio
   */
  playFallbackAlarm() {
    try {
      // Create a simple beep sound using a data URL
      const audioData = this.generateBeepAudio();
      const audio = new Audio(audioData);
      audio.volume = 0.5;
      audio.play().catch(err => console.error('❌ Audio play failed:', err));
    } catch (error) {
      console.error('❌ Fallback alarm failed:', error);
    }
  }

  /**
   * Generate a beep sound as base64 data URL
   */
  generateBeepAudio() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.5;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    const frequency = 2000;

    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3;
    }

    // Return as blob URL (in production, consider using a pre-recorded audio file)
    return 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
  }

  /**
   * Stop the alarm
   */
  stopAlarm() {
    this.isAlarmActive = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Destroy the service
   */
  destroy() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.stopAlarm();
    console.log('🛑 Attendance alarm service destroyed');
  }

  /**
   * Request notification permission
   */
  static requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

// Create singleton instance
const attendanceAlarmService = new AttendanceAlarmService();

export default attendanceAlarmService;
