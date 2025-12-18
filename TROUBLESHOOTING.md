# Troubleshooting Guide

## Common Issues and Solutions

### 1. Firebase Connection Failed

#### Symptoms:
- "Firebase connection failed" message
- Unable to load data in the application
- Authentication errors

#### Solutions:

1. **Check Firebase Configuration**
   - Verify all values in `admin-panel/src/firebase.js` match your Firebase project
   - Ensure `google-services.json` is in the correct location for the technician app

2. **Verify Internet Connection**
   - Test connectivity to Firebase servers
   - Check firewall settings

3. **Check Firebase Console**
   - Ensure Realtime Database is created and in "Test mode"
   - Verify Authentication providers are enabled
   - Check for any usage limits exceeded

4. **Browser Issues**
   - Try a different browser
   - Clear browser cache and cookies
   - Disable browser extensions

### 2. Authentication Errors

#### Symptoms:
- Login fails with "Invalid credentials"
- Unable to create accounts
- OTP verification fails

#### Solutions:

1. **Enable Authentication Providers**
   - In Firebase Console → Authentication → Sign-in method
   - Enable Email/Password provider
   - Enable Phone provider

2. **Check Phone Number Format**
   - Use international format (+91 for India)
   - Include country code

3. **Test with Demo Credentials**
   - Admin Panel: admin@example.com / admin123

### 3. Data Not Loading

#### Symptoms:
- Empty tables or lists
- "No data found" messages
- Loading indicators that never complete

#### Solutions:

1. **Check Database Rules**
   - Ensure Realtime Database is in "Test mode"
   - Rules should allow read/write access

2. **Verify Database Structure**
   - Check that collections exist
   - Verify data format matches expected structure

3. **Test Connection**
   - Use the Connection Test page in the admin panel
   - Look for specific error messages

### 4. Mobile App Issues

#### Symptoms:
- App crashes on startup
- Connection test fails
- Features not working as expected

#### Solutions:

1. **Check Dependencies**
   - Run `flutter pub get` in the technician app directory
   - Ensure all packages are installed

2. **Verify Google Services File**
   - Ensure `google-services.json` is in `android/app/` directory
   - File should match your Firebase project

3. **Test on Different Devices**
   - Try on emulator
   - Test on physical device

### 5. Web Deployment Issues

#### Symptoms:
- Blank pages after deployment
- 404 errors
- Features not working

#### Solutions:

1. **Check Build Process**
   - Ensure build completes without errors
   - Verify build output directory

2. **Configure Hosting Correctly**
   - For single-page apps, configure rewrite rules
   - Ensure index.html is served for all routes

3. **Check File Permissions**
   - Verify all files are uploaded
   - Check file access permissions

## Debugging Steps

### For Admin Panel:

1. Open browser Developer Tools (F12)
2. Check Console tab for error messages
3. Check Network tab for failed requests
4. Look for Firebase-related errors

### For Technician App:

1. Check debug console in your IDE
2. Look for Flutter error messages
3. Verify all dependencies are resolved

## Emergency Solutions

### If Nothing Works:

1. **Reset Firebase Configuration**
   - Double-check all Firebase config values
   - Recreate `google-services.json` file

2. **Use Local Storage Mode**
   - Temporarily disable Firebase integration
   - Use localStorage for development

3. **Check Firebase Status**
   - Visit https://status.firebase.google.com/
   - Check for any ongoing outages

## Getting Help

If you're still experiencing issues:

1. **Document the Problem**
   - Take screenshots of error messages
   - Note steps to reproduce
   - Include browser/device information

2. **Check Firebase Logs**
   - In Firebase Console → Project Overview → Logs
   - Look for any error patterns

3. **Contact Support**
   - Firebase Support
   - Community forums
   - Stack Overflow

## Prevention Tips

1. **Regular Testing**
   - Test connection regularly
   - Verify data flow between apps

2. **Backup Configuration**
   - Keep copies of config files
   - Document Firebase setup

3. **Monitor Usage**
   - Check Firebase usage limits
   - Monitor for any unexpected spikes