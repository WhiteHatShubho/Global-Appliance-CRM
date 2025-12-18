class JobAlertService {
  constructor() {
    this.ALERT_SOUND_KEY = 'jobAlertSound';
    this.NEW_JOBS_KEY = 'newJobsAlert';
    this.audioElement = null;
    this.isPlaying = false;
    this.lastAlertTime = 0;
    this.ALERT_COOLDOWN = 500; // Prevent multiple alerts within 500ms
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
  }

  // Initialize Web Audio API context
  initializeAudio() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ Web Audio API initialized');
      }
    } catch (error) {
      console.error('Error initializing Web Audio API:', error);
    }
  }

  // Play alert sound using Web Audio API with better volume and pattern
  playAlertSound() {
    try {
      const now = Date.now();
      
      // Prevent alert spam
      if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
        console.log('Alert sound ignored - cooldown active');
        return;
      }

      this.lastAlertTime = now;

      if (!this.audioContext) {
        this.initializeAudio();
      }

      // Create multiple oscillators for a more noticeable sound
      this.createMultiToneAlert();
    } catch (error) {
      console.error('Error playing alert sound:', error);
      this.playFallbackBeep();
    }
  }

  // Create multi-tone alert (beep beep beep pattern) for better attention
  createMultiToneAlert() {
    try {
      const audioContext = this.audioContext;
      const currentTime = audioContext.currentTime;
      
      // Create master gain node for overall volume
      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.setValueAtTime(1.0, currentTime); // Maximum volume

      // Beep pattern: 3 beeps at different frequencies
      const frequencies = [800, 1000, 800]; // Hz
      const beepDuration = 0.3; // seconds per beep
      const pauseDuration = 0.1; // pause between beeps
      let scheduleTime = currentTime;

      frequencies.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(masterGain);
        
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

      // Repeat pattern 10 times (30 seconds total)
      const patternDuration = (beepDuration + pauseDuration) * frequencies.length;
      for (let i = 1; i < 10; i++) {
        frequencies.forEach((freq, index) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          
          osc.connect(gain);
          gain.connect(masterGain);
          
          osc.frequency.value = freq;
          osc.type = 'sine';
          
          const repeatTime = currentTime + (i * patternDuration);
          
          gain.gain.setValueAtTime(0, repeatTime);
          gain.gain.linearRampToValueAtTime(0.5, repeatTime + 0.05);
          gain.gain.setValueAtTime(0.5, repeatTime + beepDuration - 0.05);
          gain.gain.linearRampToValueAtTime(0, repeatTime + beepDuration);
          
          osc.start(repeatTime);
          osc.stop(repeatTime + beepDuration);
        });
      }

      this.isPlaying = true;
      console.log('🔊 Multi-tone alert started (30 seconds)');
    } catch (error) {
      console.error('Error creating multi-tone alert:', error);
      this.playFallbackBeep();
    }
  }

  // Stop alert sound
  stopAlertSound() {
    try {
      if (this.oscillator && this.oscillator.state !== 'ended') {
        this.oscillator.stop();
      }
      this.isPlaying = false;
      console.log('🔊 Alert sound stopped');
    } catch (error) {
      console.error('Error stopping alert sound:', error);
    }
  }

  // Check for new jobs and trigger alert
  checkForNewJobs(currentJobIds, previousJobIds) {
    // Find new job IDs
    const newJobIds = currentJobIds.filter(id => !previousJobIds.includes(id));
    
    if (newJobIds.length > 0) {
      console.log('🚨 New job detected:', newJobIds);
      this.triggerNewJobAlert(newJobIds);
      return true;
    }
    
    return false;
  }

  // Trigger new job notification and sound
  triggerNewJobAlert(newJobIds) {
    try {
      // Play alert sound LOUDLY
      console.log('🔊 Playing alert sound at maximum volume');
      this.playAlertSound();

      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        this.showBrowserNotifications(newJobIds);
      }

      // Store alert state
      localStorage.setItem(this.NEW_JOBS_KEY, JSON.stringify({
        jobIds: newJobIds,
        timestamp: Date.now(),
        acknowledged: false
      }));
    } catch (error) {
      console.error('Error triggering job alert:', error);
    }
  }

  // Show browser notifications
  showBrowserNotifications(jobIds) {
    try {
      jobIds.forEach((jobId, index) => {
        // Stagger notifications slightly
        setTimeout(() => {
          new Notification('🚨 NEW JOB ALERT!', {
            body: 'You have received a new urgent job assignment. Open the app immediately to view details.',
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: 'new-job-alert-' + index,
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200, 100, 200], // Persistent vibration
            silent: false // Allow sound from notification
          });
        }, index * 300);
      });
    } catch (error) {
      console.error('Error showing notifications:', error);
    }
  }

  // Request notification permission
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  // Acknowledge new jobs (called when user opens app)
  acknowledgeNewJobs() {
    try {
      this.stopAlertSound();
      
      // Close all notifications
      if ('Notification' in window) {
        Notification.close && Notification.close();
      }

      localStorage.removeItem(this.NEW_JOBS_KEY);
      console.log('✅ New job alert acknowledged');
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }

  // Get pending job alert
  getPendingJobAlert() {
    try {
      const alertData = localStorage.getItem(this.NEW_JOBS_KEY);
      if (alertData) {
        return JSON.parse(alertData);
      }
    } catch (error) {
      console.error('Error getting pending alert:', error);
    }
    return null;
  }

  // Check if alert is still active
  isAlertActive() {
    const alertData = this.getPendingJobAlert();
    return alertData && !alertData.acknowledged;
  }

  // Resume alert sound if app is reopened with pending alert
  resumeAlertIfNeeded() {
    if (this.isAlertActive()) {
      console.log('🔊 Resuming alert sound - new job still pending');
      this.playAlertSound();
    }
  }

  // Cleanup on app unload
  cleanup() {
    try {
      if (this.oscillator && this.oscillator.state !== 'ended') {
        this.oscillator.stop();
      }
      this.isPlaying = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

const jobAlertService = new JobAlertService();
export default jobAlertService;
