# Admin Web Panel

This is a React-based web application for administrators to manage the service management system.

## Setup Options

### Option 1: Firebase with Free Tier (Recommended for Testing)

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Firebase Authentication (Email/Password method)
3. Enable Firebase Realtime Database
4. Update the Firebase configuration in `src/firebase.js`

### Option 2: Local Storage Only (Completely Free)

The application is already configured to work with localStorage for development and testing purposes.

## Installation

1. Install Node.js and npm
2. Run `npm install` to install dependencies
3. Run `npm start` to start the development server

## Features

- Email/password authentication
- Dashboard with key metrics
- Customer management (CRUD operations)
- Ticket management (creation, assignment, status tracking)
- Technician management (profiles, status)
- Payment tracking and reporting
- Detailed reporting capabilities

## Dependencies

- React.js
- React Router
- Firebase (optional)
- LocalStorage (for free version)

## Building for Production

To build for production:
```
npm run build
```

## Deployment

### Option 1: Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize Firebase in your project: `firebase init`
4. Select "Hosting" when prompted
5. Set the public directory to `build`
6. Configure as a single-page app
7. Deploy: `firebase deploy`

### Option 2: Any Static Hosting

1. Build the application: `npm run build`
2. Upload the contents of the `build` directory to any static hosting service