# Free Version Setup Guide

This guide explains how to set up and use the Service Management System without incurring any costs.

## Overview

The system consists of two main components:
1. **Admin Web Panel** - A React.js web application
2. **Technician Mobile App** - A Flutter mobile application

Both applications can be configured to work without paid Firebase services.

## Admin Web Panel Setup (Free)

### Option 1: Local Storage (Completely Free)

The admin panel is already configured to work with localStorage:

1. Navigate to the `admin-panel` directory
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Access the application at http://localhost:3000
5. Login with demo credentials:
   - Email: `admin@example.com`
   - Password: `admin123`

### Features Available with Local Storage:
- All CRUD operations for customers, tickets, technicians, and payments
- Dashboard with statistics
- Reports generation
- Data persistence between sessions

### Option 2: Firebase Free Tier

If you want to use Firebase:

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Firebase Authentication (Email/Password)
3. Enable Firebase Realtime Database (not Firestore)
4. Set up security rules in "Test mode"
5. Update `src/firebase.js` with your Firebase configuration
6. Uncomment Firebase code in components

## Technician Mobile App Setup (Free)

### Option 1: Local Storage (Completely Free)

1. Navigate to the `technician_app` directory
2. Install dependencies: `flutter pub get`
3. Run the app: `flutter run`

### Features Available with Local Storage:
- All job management features
- Data persistence between sessions
- Photo placeholders (no actual image upload)

### Option 2: Firebase Free Tier

If you want to use Firebase:

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Firebase Authentication (Phone)
3. Enable Firebase Realtime Database (not Firestore)
4. Add your Android app to Firebase
5. Download `google-services.json` and place in `android/app/`
6. Set up security rules in "Test mode"
7. Uncomment Firebase code in services

## Data Structure

Both applications use the same data structure:

### Customers
- id: Unique identifier
- name: Customer name
- phone: Phone number
- email: Email address
- address: Physical address

### Tickets
- id: Unique identifier (TCK-XXX format)
- customerId: Reference to customer
- customerName: Customer name
- title: Ticket title
- description: Detailed description
- status: open, assigned, in_progress, completed, closed
- priority: low, medium, high
- assignedTo: Technician name
- createdAt: Creation date
- updatedAt: Last update date

### Technicians
- id: Unique identifier
- name: Technician name
- phone: Phone number
- email: Email address
- status: active, inactive

### Payments
- id: Unique identifier (PAY-XXX format)
- ticketId: Reference to ticket
- technician: Technician name
- amount: Payment amount
- method: cash, upi
- referenceId: UPI reference (if applicable)
- status: pending, completed
- date: Payment date

## Testing the Workflow

1. Start the admin panel: `npm start` in `admin-panel` directory
2. Start the technician app: `flutter run` in `technician_app` directory
3. Login to admin panel with demo credentials
4. Create customers and tickets
5. Assign tickets to technicians
6. Login to technician app (use any phone number for demo)
7. View assigned tickets
8. Complete jobs and process payments
9. Check data synchronization in admin panel

## Limitations of Free Version

1. **No Real-time Synchronization**: Data changes in one application won't immediately reflect in the other
2. **No Image Upload**: Photo functionality uses placeholders
3. **No Real Authentication**: Login uses demo credentials
4. **Limited Storage**: localStorage has size limitations
5. **No Push Notifications**: No real-time alerts

## Upgrading to Paid Version

To get full functionality:

1. Enable billing on your Firebase project
2. Upgrade to Blaze plan
3. Enable Firestore instead of Realtime Database
4. Enable Firebase Storage for image uploads
5. Implement proper authentication
6. Set up proper security rules

## Troubleshooting

### Admin Panel Issues

1. **Blank Screen**: Check browser console for errors
2. **Login Failed**: Use demo credentials (admin@example.com / admin123)
3. **Data Not Loading**: Clear browser cache and localStorage

### Technician App Issues

1. **Build Failures**: Run `flutter pub get` to update dependencies
2. **Runtime Errors**: Check debug console for error messages
3. **Performance Issues**: Close other applications to free up resources

## Next Steps

1. Test all features with the free version
2. Create actual Firebase project when ready to upgrade
3. Deploy to hosting services for public access
4. Add additional features as needed