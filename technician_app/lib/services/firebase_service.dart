import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';

class FirebaseService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  late final DatabaseReference _database;
  
  FirebaseService() {
    // Initialize database with web compatibility
    if (kIsWeb) {
      _database = FirebaseDatabase.instance.reference();
    } else {
      _database = FirebaseDatabase.instance.reference();
    }
  }

  // Authentication methods
  Future<User?> signInWithPhone(String phone) async {
    // In a real app, you would implement phone authentication
    // This is a simplified version for demonstration
    print('Signing in with phone: $phone');
    return _auth.currentUser;
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }

  // Database methods
  Stream<DatabaseEvent> getTickets(String technicianId) {
    return _database
        .child('tickets')
        .orderByChild('assignedTo')
        .equalTo(technicianId)
        .onValue;
  }

  Stream<DatabaseEvent> getTicket(String ticketId) {
    return _database.child('tickets').child(ticketId).onValue;
  }

  Future<void> updateTicketStatus(String ticketId, String status) async {
    await _database.child('tickets').child(ticketId).update({
      'status': status,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> createVisit(Map<String, dynamic> visitData) async {
    await _database.child('visits').push().set(visitData);
  }

  Future<void> createPayment(Map<String, dynamic> paymentData) async {
    await _database.child('payments').push().set(paymentData);
  }

  // Storage methods
  Future<String> uploadImage(String filePath, String fileName) async {
    // In a real app, you would upload the image to Firebase Storage
    print('Uploading image: $fileName');
    return 'https://via.placeholder.com/150'; // Placeholder URL for now
  }
}