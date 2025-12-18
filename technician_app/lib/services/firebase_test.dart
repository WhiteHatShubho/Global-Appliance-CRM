// Firebase connection test for Technician App
import 'package:firebase_database/firebase_database.dart';

class FirebaseTest {
  final DatabaseReference _database = FirebaseDatabase.instance.reference();

  // Test Firebase connection
  Future<bool> testConnection() async {
    try {
      print('Testing Firebase connection...');
      
      // Test by writing a test value
      await _database.child('test/connection').set({
        'timestamp': DateTime.now().toIso8601String(),
        'status': 'connected'
      });
      
      print('Firebase connection successful!');
      return true;
    } catch (e, stackTrace) {
      print('Firebase connection failed: $e');
      print('Stack trace: $stackTrace');
      return false;
    }
  }

  // Test reading data
  Future<void> testRead() async {
    try {
      final snapshot = await _database.child('test/connection').once();
      print('Read from Firebase: ${snapshot.value}');
    } catch (e, stackTrace) {
      print('Firebase read failed: $e');
      print('Stack trace: $stackTrace');
    }
  }
}