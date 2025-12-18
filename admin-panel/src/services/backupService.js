/**
 * Automated Backup Service
 * Handles regular backups to multiple locations for data protection
 */

import { getDatabase, ref, get, child } from 'firebase/database';

class BackupService {
  constructor() {
    this.database = null;
    this.lastBackupTime = null;
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.backups = [];
  }

  initialize(firebaseApp) {
    this.database = getDatabase(firebaseApp);
    this.startAutoBackup();
    console.log('📦 Backup Service initialized');
  }

  /**
   * Start automatic daily backups
   */
  startAutoBackup() {
    // Perform backup every 24 hours
    setInterval(async () => {
      console.log('⏰ Starting scheduled daily backup...');
      await this.performFullBackup();
    }, this.backupInterval);

    // Also perform one on initialization
    this.performFullBackup();
  }

  /**
   * Perform a full backup of all data
   */
  async performFullBackup() {
    if (!this.database) {
      console.error('Database not initialized for backup');
      return null;
    }

    try {
      console.log('🔄 Creating full backup...');
      const timestamp = new Date().toISOString();

      const backup = {
        timestamp,
        data: {
          customers: await this.getAllData('customers'),
          tickets: await this.getAllData('tickets'),
          payments: await this.getAllData('payments'),
          technicians: await this.getAllData('technicians'),
          jobHistory: await this.getAllData('jobHistory'),
          paymentHistory: await this.getAllData('paymentHistory'),
          callLogs: await this.getAllData('callLogs')
        }
      };

      // Save to localStorage (limited to 10 backups)
      await this.saveBackupToLocal(backup);

      // Save to IndexedDB for larger storage
      await this.saveBackupToIndexedDB(backup);

      this.lastBackupTime = timestamp;
      console.log('✅ Full backup completed at', timestamp);

      return backup;
    } catch (error) {
      console.error('❌ Backup error:', error);
      return null;
    }
  }

  /**
   * Get all data from a specific collection
   */
  async getAllData(collection) {
    try {
      const snapshot = await get(child(ref(this.database), collection));
      return snapshot.val() || {};
    } catch (error) {
      console.error(`Error getting ${collection}:`, error);
      return {};
    }
  }

  /**
   * Save backup to localStorage (keeps last 10 backups)
   */
  async saveBackupToLocal(backup) {
    try {
      const backups = JSON.parse(localStorage.getItem('backups') || '[]');
      backups.push(backup);

      // Keep only last 10 backups
      if (backups.length > 10) {
        backups.shift();
      }

      localStorage.setItem('backups', JSON.stringify(backups));
      console.log('💾 Backup saved to localStorage');
      return true;
    } catch (error) {
      console.error('Error saving backup to localStorage:', error);
      return false;
    }
  }

  /**
   * Save backup to IndexedDB for larger storage capacity
   */
  async saveBackupToIndexedDB(backup) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AppBackups', 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'timestamp' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('backups', 'readwrite');
        const store = transaction.objectStore('backups');

        // Keep only last 20 backups
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const allBackups = getAllRequest.result;
          if (allBackups.length >= 20) {
            // Delete oldest backups
            for (let i = 0; i < allBackups.length - 19; i++) {
              store.delete(allBackups[i].timestamp);
            }
          }
        };

        const addRequest = store.add(backup);
        addRequest.onsuccess = () => {
          console.log('💾 Backup saved to IndexedDB');
          resolve(true);
        };
        addRequest.onerror = () => {
          console.error('Error saving to IndexedDB:', addRequest.error);
          reject(addRequest.error);
        };
      };
    });
  }

  /**
   * Get all available backups from localStorage
   */
  getLocalBackups() {
    try {
      return JSON.parse(localStorage.getItem('backups') || '[]');
    } catch (error) {
      console.error('Error getting backups:', error);
      return [];
    }
  }

  /**
   * Get all available backups from IndexedDB
   */
  async getIndexedDBBackups() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AppBackups', 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('backups', 'readonly');
        const store = transaction.objectStore('backups');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result);
        };
        getAllRequest.onerror = () => {
          reject(getAllRequest.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Restore from a specific backup
   */
  async restoreFromBackup(backupTimestamp) {
    const backups = this.getLocalBackups();
    const backup = backups.find(b => b.timestamp === backupTimestamp);

    if (!backup) {
      console.error('Backup not found:', backupTimestamp);
      return false;
    }

    console.log('⚠️ WARNING: Restoring from backup - this will overwrite current data!');
    console.log('Backup timestamp:', backupTimestamp);

    return backup;
  }

  /**
   * Export backup as JSON file
   */
  exportBackup(backup) {
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${backup.timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get the last backup time
   */
  getLastBackupTime() {
    return this.lastBackupTime;
  }
}

const backupService = new BackupService();
export default backupService;
