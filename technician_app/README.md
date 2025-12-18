# Technician App

This is a Flutter-based mobile application for field technicians to manage service jobs.

## Setup Options

### Option 1: Firebase with Free Tier (Recommended for Testing)

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Firebase Authentication (Phone method)
3. Enable Firebase Realtime Database
4. Add your Android app to the Firebase project
5. Download `google-services.json` and place it in `android/app/`
6. Update the Firebase configuration in `lib/services/firebase_service.dart`

### Option 2: Local Storage Only (Completely Free)

1. Comment out all Firebase dependencies in `pubspec.yaml`
2. Uncomment the alternative main function in `lib/main.dart`
3. Use `lib/services/local_storage_service.dart` for data storage

## Installation

1. Install Flutter SDK
2. Run `flutter pub get` to install dependencies
3. For Firebase setup, ensure `google-services.json` is in place
4. Run `flutter run` to start the app

## Features

- Phone number authentication with OTP
- Today's jobs listing
- Job details view
- Job completion with:
  - Work description
  - Parts used
  - Before/after photos
  - Customer signature
- Payment processing (Cash/UPI)
- Job history
- Technician profile

## Dependencies

- Flutter SDK
- Firebase Core
- Firebase Auth
- Firebase Database
- Provider for state management
- Image Picker for photo capture
- Signature for customer signatures
- Shared Preferences for local storage

## Building for Release

To build an APK for Android:
```
flutter build apk --release
```

To build an app bundle for Play Store:
```
flutter build appbundle --release
```