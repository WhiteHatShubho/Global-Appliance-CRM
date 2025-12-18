# Deployment Guide

## Admin Web Panel Deployment

### Prerequisites
- Node.js and npm installed
- Firebase account with a configured project

### Steps

1. **Configure Firebase**
   - Create a new Firebase project or use an existing one
   - Enable Firebase Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Firebase Storage (for future use)
   - Copy your Firebase configuration details

2. **Update Configuration**
   - Open `admin-panel/src/firebase.js`
   - Replace the placeholder configuration with your actual Firebase project credentials:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdefghijklmnopqrstuv"
   };
   ```

3. **Install Dependencies**
   ```bash
   cd admin-panel
   npm install
   ```

4. **Test Locally**
   ```bash
   npm start
   ```
   This will start the development server on `http://localhost:3000`

5. **Build for Production**
   ```bash
   npm run build
   ```
   This creates an optimized production build in the `build/` directory

6. **Deploy to Firebase Hosting**
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login to Firebase: `firebase login`
   - Initialize Firebase in your project:
     ```bash
     firebase init
     ```
   - Select "Hosting" when prompted
   - Set the public directory to `build`
   - Configure as a single-page app (rewrite all URLs to /index.html)
   - Deploy:
     ```bash
     firebase deploy
     ```

## Technician Android App Deployment

### Prerequisites
- Flutter SDK installed
- Android Studio with Android SDK
- Firebase account with a configured project

### Steps

1. **Configure Firebase**
   - Create a new Firebase project or use an existing one
   - Enable Firebase Authentication (Phone)
   - Enable Firestore Database
   - Enable Firebase Storage

2. **Add Android App to Firebase**
   - In the Firebase console, add a new Android app
   - Use package name: `com.example.technician_app`
   - Download the `google-services.json` file
   - Place it in `technician_app/android/app/` directory

3. **Update Configuration**
   - Open `technician_app/lib/services/firebase_service.dart`
   - Update any placeholder values with your actual Firebase configuration

4. **Install Dependencies**
   ```bash
   cd technician_app
   flutter pub get
   ```

5. **Test on Emulator or Device**
   ```bash
   flutter run
   ```

6. **Build APK for Release**
   ```bash
   flutter build apk --release
   ```
   This creates a release APK in `build/app/outputs/flutter-apk/app-release.apk`

7. **Build App Bundle for Play Store**
   ```bash
   flutter build appbundle --release
   ```
   This creates an app bundle in `build/app/outputs/bundle/release/app-release.aab`

## Firebase Security Rules

Deploy the security rules from `firebase.rules` to your Firebase project:

1. In the Firebase console, go to Firestore Database
2. Click on "Rules" tab
3. Replace the existing rules with the content from `firebase.rules`
4. Publish the rules

## Environment Variables

For production deployment, make sure to set the following environment variables:

### Admin Web Panel
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`

## Testing the Complete Workflow

1. **Admin creates a ticket**
   - Login to the admin panel
   - Navigate to Tickets section
   - Create a new ticket

2. **Admin assigns ticket to technician**
   - In the ticket details, assign to a technician

3. **Technician works on the job**
   - Technician logs in with phone number
   - Views assigned ticket
   - Starts job
   - Completes job with details, photos, and signature

4. **Payment collection**
   - Technician enters payment details
   - Selects payment method (Cash/UPI)
   - Processes payment

5. **Job closure**
   - System updates ticket status to "completed"
   - Payment record is created
   - Job appears in history

## Troubleshooting

### Admin Web Panel
- If the app fails to start, check Firebase configuration
- Ensure all required environment variables are set
- Check browser console for errors

### Technician App
- If authentication fails, verify phone number format
- Ensure `google-services.json` is correctly placed
- Check Android permissions for camera and storage

### Firebase Issues
- Verify Firestore rules are correctly deployed
- Check Firebase project settings and credentials
- Ensure proper indexing for query performance