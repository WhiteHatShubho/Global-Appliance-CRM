# Firebase Online Setup Guide (Free Tier)

This guide explains how to set up Firebase for the Service Management System using only free services.

## Prerequisites

1. Google Account
2. Node.js and npm installed (for admin panel)
3. Flutter SDK installed (for technician app)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: "Service Management System"
4. Accept terms and conditions
5. Choose whether to enable Google Analytics (optional)
6. Click "Create project"

## Step 2: Enable Authentication Methods

1. In Firebase Console, click "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable:
   - **Email/Password** (for admin panel)
   - **Phone** (for technician app)

## Step 3: Set Up Realtime Database

1. Click "Realtime Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in test mode"
4. Select a location near you
5. Click "Enable"

## Step 4: Configure Admin Panel

1. In Firebase Console, click the gear icon and select "Project settings"
2. In the "General" tab, scroll down to "Your apps"
3. Click "</>" to create a web app
4. Register app name: "Admin Panel"
5. Skip Firebase Hosting setup
6. Copy the firebaseConfig object
7. Update `admin-panel/src/firebase.js` with your configuration

## Step 5: Configure Technician App

1. In Firebase Console, in "Project settings" → "General" tab
2. Click "Android" to add Android app
3. Package name: `com.example.technician_app`
4. App nickname: "Technician App"
5. Skip debug signing key (for development)
6. Download `google-services.json`
7. Place it in `technician_app/android/app/` directory

## Step 6: Test the Setup

### Admin Panel:
```bash
cd admin-panel
npm install
npm start
```

### Technician App:
```bash
cd technician_app
flutter pub get
flutter run
```

## Firebase Free Tier Limits

### Authentication
- 50,000 monthly active users (MAUs)
- Phone authentication included

### Realtime Database
- 1GB storage
- 100 simultaneous connections
- 10GB monthly data transfer

### No Billing Required
- These services work without enabling billing
- Perfect for development and small production use

## Security Rules

The default test mode rules allow full read/write access for 30 days:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

After 30 days, you'll need to update the rules, but by then your system will be working and you can decide if you want to continue with Firebase or migrate to another solution.

## Benefits of This Approach

✅ **Completely Online** - Real-time data synchronization
✅ **Free Forever** - No billing required for these services
✅ **Full Functionality** - All features work
✅ **Scalable** - Can upgrade when needed
✅ **Professional** - Production-ready setup

## Next Steps

1. Test all features with the free Firebase setup
2. Create admin accounts through the admin panel
3. Create technician accounts
4. Test the complete workflow
5. When ready, you can deploy to production:
   - Admin Panel: Firebase Hosting (Free)
   - Technician App: Google Play Store

## Troubleshooting

### Common Issues:

1. **Firebase config not found**: Make sure you've updated the firebase.js file
2. **Authentication errors**: Check that you've enabled the correct sign-in methods
3. **Database connection issues**: Verify Realtime Database is set to "Test mode"
4. **Android build failures**: Ensure google-services.json is in the correct location

### Getting Help:

1. Check Firebase Console for error logs
2. Verify all configuration files are correctly updated
3. Ensure all dependencies are installed
4. Check that you're using the correct package names