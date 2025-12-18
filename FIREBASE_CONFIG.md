# Firebase Configuration Summary

## Project Details

- **Project Name**: Service Management System
- **Project ID**: service-management-syste-5a9f5
- **Firebase Console**: https://console.firebase.google.com/project/service-management-syste-5a9f5

## Admin Panel Configuration

### Web App Configuration
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
  authDomain: "service-management-syste-5a9f5.firebaseapp.com",
  databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
  projectId: "service-management-syste-5a9f5",
  storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
  messagingSenderId: "719700732732",
  appId: "1:719700732732:web:0cbc53d5e99f66cb148c39"
};
```

### Services Enabled
1. **Authentication**
   - Email/Password provider
   - Phone provider
2. **Realtime Database**
   - Test mode rules
   - Database URL: https://service-management-syste-5a9f5-default-rtdb.firebaseio.com

## Technician App Configuration

### Android App Configuration
- **Package Name**: com.example.technician_app
- **SHA-1 Certificate**: Not required for development
- **Google Services File**: `google-services.json` (to be downloaded and placed in `android/app/`)

### Firebase Options
```dart
FirebaseOptions(
  apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
  authDomain: "service-management-syste-5a9f5.firebaseapp.com",
  databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
  projectId: "service-management-syste-5a9f5",
  storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
  messagingSenderId: "719700732732",
  appId: "1:719700732732:web:0cbc53d5e99f66cb148c39",
)
```

## Database Structure

### Collections
1. **customers**
   - id: string
   - name: string
   - phone: string
   - email: string
   - address: string

2. **tickets**
   - id: string
   - customerId: string
   - customerName: string
   - title: string
   - description: string
   - status: string (open, assigned, in_progress, completed, closed)
   - priority: string (low, medium, high)
   - assignedTo: string (technician name)
   - createdAt: string (date)
   - updatedAt: string (date)

3. **technicians**
   - id: string
   - name: string
   - phone: string
   - email: string
   - status: string (active, inactive)

4. **payments**
   - id: string
   - ticketId: string
   - technician: string
   - amount: number
   - method: string (cash, upi)
   - referenceId: string
   - status: string (pending, completed)
   - date: string (date)

5. **visits**
   - id: string (auto-generated)
   - ticketId: string
   - technicianId: string
   - startTime: string (timestamp)
   - endTime: string (timestamp)
   - workDone: string
   - partsUsed: array
   - beforePhotos: array
   - afterPhotos: array
   - customerSignature: string (base64)
   - status: string (started, completed)

## Security Rules (Test Mode)

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## Testing Connection

Both applications include connection testing features:
- **Admin Panel**: Connection status displayed at the top of the app
- **Technician App**: Floating action button to test connection

## Next Steps

1. Download `google-services.json` from Firebase Console
2. Place it in `technician_app/android/app/`
3. Test both applications
4. Create initial admin account
5. Create technician accounts
6. Test the complete workflow

## Troubleshooting

### Common Issues
1. **Connection Failed**: Verify all configuration values match exactly
2. **Authentication Errors**: Ensure providers are enabled in Firebase Console
3. **Database Access**: Check that Realtime Database is in test mode
4. **Missing Dependencies**: Run `flutter pub get` in technician app

### Getting Help
1. Check Firebase Console logs
2. Verify internet connectivity
3. Confirm Firebase project settings
4. Validate configuration files