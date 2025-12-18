/* eslint-disable no-undef */
/**
 * Google Drive Cloud Backup Service
 * Automatically syncs backups to Google Drive
 */

class GoogleDriveBackup {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.folderId = null;
    this.syncInterval = null;
  }

  /**
   * Initialize Google Drive API
   * Uses the Google API Client Library
   */
  async initializeGoogleDrive() {
    return new Promise((resolve, reject) => {
      // Check if gapi is already loaded
      if (typeof gapi !== 'undefined' && gapi.client) {
        resolve();
        return;
      }
      
      // Wait for gapi to load
      const checkGapi = setInterval(() => {
        if (typeof gapi !== 'undefined') {
          clearInterval(checkGapi);
          gapi.load('client:auth2', () => {
            resolve();
          });
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGapi);
        reject(new Error('Google API failed to load'));
      }, 10000);
    });
  }

  /**
   * Authenticate with Google Account
   */
  async authenticateGoogle(clientId) {
    try {
      await gapi.client.init({
        clientId: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
      });

      const authResult = await gapi.auth2.getAuthInstance().signIn();
      
      if (authResult) {
        this.accessToken = authResult.getAuthResponse().id_token;
        this.isAuthenticated = true;
        console.log('✅ Google Drive authenticated');
        
        // Create backup folder
        await this.createBackupFolder();
        return { success: true, message: 'Google Drive authenticated' };
      }
    } catch (error) {
      console.error('❌ Google authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create backup folder in Google Drive
   */
  async createBackupFolder() {
    try {
      // Check if folder exists
      const response = await gapi.client.drive.files.list({
        q: "name='GlobalApplianceBackup' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (response.result.files.length > 0) {
        this.folderId = response.result.files[0].id;
        console.log('✅ Backup folder found:', this.folderId);
      } else {
        // Create folder
        const createResponse = await gapi.client.drive.files.create({
          resource: {
            name: 'GlobalApplianceBackup',
            mimeType: 'application/vnd.google-apps.folder',
            description: 'Automatic backups for Global Appliance CRM'
          },
          fields: 'id'
        });

        this.folderId = createResponse.result.id;
        console.log('✅ Backup folder created:', this.folderId);
      }

      return { success: true, folderId: this.folderId };
    } catch (error) {
      console.error('❌ Folder creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload backup to Google Drive
   */
  async uploadBackupToGoogleDrive(backupData, filename) {
    if (!this.isAuthenticated || !this.folderId) {
      return { success: false, error: 'Not authenticated with Google Drive' };
    }

    try {
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: [this.folderId],
        description: `Backup created at ${new Date().toISOString()}`
      };

      const backupJson = JSON.stringify(backupData, null, 2);
      const file = new Blob([backupJson], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,createdTime,fileSize', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
        body: form
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Backup uploaded to Google Drive:', result.id);
        return {
          success: true,
          fileId: result.id,
          link: result.webViewLink,
          message: `Backup uploaded successfully`
        };
      } else {
        throw new Error('Upload failed: ' + response.statusText);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete old backups from Google Drive (keep last 10)
   */
  async deleteOldBackups() {
    if (!this.isAuthenticated || !this.folderId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await gapi.client.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, createdTime, name)',
        orderBy: 'createdTime desc',
        pageSize: 100
      });

      const files = response.result.files;
      let deletedCount = 0;

      // Keep last 10, delete the rest
      if (files.length > 10) {
        for (let i = 10; i < files.length; i++) {
          await gapi.client.drive.files.delete({ fileId: files[i].id });
          deletedCount++;
        }
      }

      console.log(`✅ Deleted ${deletedCount} old backups from Google Drive`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('❌ Delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all backups in Google Drive
   */
  async listBackups() {
    if (!this.isAuthenticated || !this.folderId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await gapi.client.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, createdTime, fileSize, webViewLink)',
        orderBy: 'createdTime desc',
        pageSize: 20
      });

      const files = response.result.files.map(file => ({
        id: file.id,
        name: file.name,
        created: file.createdTime,
        size: file.fileSize,
        link: file.webViewLink
      }));

      console.log('✅ Retrieved backup list:', files.length);
      return { success: true, backups: files };
    } catch (error) {
      console.error('❌ List error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start auto-sync to Google Drive (every 30 minutes)
   */
  startAutoSync(backupService, interval = 30) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        // Get latest backup from local storage
        const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];
        const backupData = {
          timestamp: new Date().toISOString(),
          collections: {}
        };

        for (const collection of collections) {
          const backup = backupService.getLatestBackup(collection);
          if (backup) {
            backupData.collections[collection] = backup.data;
          }
        }

        // Upload to Google Drive
        const filename = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
        await this.uploadBackupToGoogleDrive(backupData, filename);

        // Clean up old backups
        await this.deleteOldBackups();

        console.log('🔄 Auto-sync completed');
      } catch (error) {
        console.error('❌ Auto-sync error:', error);
      }
    }, interval * 60 * 1000);

    console.log(`⏰ Google Drive auto-sync started (every ${interval} minutes)`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      console.log('⏹️ Google Drive auto-sync stopped');
    }
  }

  /**
   * Sign out from Google
   */
  async signOut() {
    try {
      await gapi.auth2.getAuthInstance().signOut();
      this.isAuthenticated = false;
      this.accessToken = null;
      this.folderId = null;
      this.stopAutoSync();
      console.log('✅ Signed out from Google Drive');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const googleDriveBackup = new GoogleDriveBackup();
