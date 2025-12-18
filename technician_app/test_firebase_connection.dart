// Simple Firebase connection test script
// Run this to test Firebase connection in the technician app

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';

void main() async {
  print('Starting Firebase connection test...');
  
  try {
    // Test 1: Initialize Firebase
    print('Test 1: Initializing Firebase...');
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: "AIzaSyDN_WvokwbsKaHJMd70hscE030DTNFfZxI",
        authDomain: "service-management-syste-5a9f5.firebaseapp.com",
        databaseURL: "https://service-management-syste-5a9f5-default-rtdb.firebaseio.com",
        projectId: "service-management-syste-5a9f5",
        storageBucket: "service-management-syste-5a9f5.firebasestorage.app",
        messagingSenderId: "719700732732",
        appId: "1:719700732732:web:0cbc53d5e99f66cb148c39",
      ),
    );
    print('✅ Firebase initialized successfully');
    
    // Test 2: Initialize Database
    print('Test 2: Initializing Firebase Database...');
    final database = FirebaseDatabase.instance;
    print('✅ Firebase Database initialized successfully');
    
    // Test 3: Write test data
    print('Test 3: Writing test data...');
    final ref = database.reference().child('test/connection');
    await ref.set({
      'timestamp': DateTime.now().toIso8601String(),
      'status': 'connected',
      'platform': 'flutter_test'
    });
    print('✅ Test data written successfully');
    
    print('🎉 All tests passed! Firebase connection is working correctly.');
    
  } catch (e, stackTrace) {
    print('❌ Test failed with error: $e');
    print('Stack trace: $stackTrace');
  }
}