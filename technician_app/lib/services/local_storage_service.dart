import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStorageService {
  static const String _ticketsKey = 'tickets';
  static const String _visitsKey = 'visits';
  static const String _paymentsKey = 'payments';
  static const String _technicianIdKey = 'technicianId';
  static const String _technicianNameKey = 'technicianName';
  static const String _technicianPhoneKey = 'technicianPhone';

  // Get SharedPreferences instance
  Future<SharedPreferences> getPreferences() async {
    return await SharedPreferences.getInstance();
  }

  // Technician info methods
  Future<String?> getTechnicianId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_technicianIdKey);
  }

  Future<String?> getTechnicianName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_technicianNameKey);
  }

  Future<String?> getTechnicianPhone() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_technicianPhoneKey);
  }

  Future<void> saveTechnicianId(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_technicianIdKey, id);
  }

  Future<void> saveTechnicianName(String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_technicianNameKey, name);
  }

  Future<void> saveTechnicianPhone(String phone) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_technicianPhoneKey, phone);
  }
  Future<void> initializeData() async {
    final prefs = await SharedPreferences.getInstance();
    
    if (!prefs.containsKey(_ticketsKey)) {
      final sampleTickets = [
        {
          'id': 'TCK-001',
          'customerId': '1',
          'customerName': 'John Doe',
          'title': 'AC Not Cooling',
          'description': 'Air conditioner is not cooling properly',
          'status': 'assigned',
          'priority': 'high',
          'assignedTo': 'tech001',
          'createdAt': '2023-05-15',
          'updatedAt': '2023-05-15',
        },
        {
          'id': 'TCK-002',
          'customerId': '2',
          'customerName': 'Jane Smith',
          'title': 'Refrigerator Noise',
          'description': 'Loud noise coming from refrigerator',
          'status': 'in_progress',
          'priority': 'medium',
          'assignedTo': 'tech001',
          'createdAt': '2023-05-15',
          'updatedAt': '2023-05-15',
        }
      ];
      await prefs.setString(_ticketsKey, jsonEncode(sampleTickets));
    }

    if (!prefs.containsKey(_visitsKey)) {
      final sampleVisits = [];
      await prefs.setString(_visitsKey, jsonEncode(sampleVisits));
    }

    if (!prefs.containsKey(_paymentsKey)) {
      final samplePayments = [];
      await prefs.setString(_paymentsKey, jsonEncode(samplePayments));
    }
  }

  // Tickets methods
  Future<List<Map<String, dynamic>>> getTickets(String technicianId) async {
    await initializeData();
    final prefs = await SharedPreferences.getInstance();
    final ticketsJson = prefs.getString(_ticketsKey) ?? '[]';
    final tickets = List<Map<String, dynamic>>.from(jsonDecode(ticketsJson));
    
    // Filter tickets by assigned technician
    return tickets.where((ticket) => ticket['assignedTo'] == technicianId).toList();
  }

  Future<void> updateTicketStatus(String ticketId, String status) async {
    final prefs = await SharedPreferences.getInstance();
    final ticketsJson = prefs.getString(_ticketsKey) ?? '[]';
    final tickets = List<Map<String, dynamic>>.from(jsonDecode(ticketsJson));
    
    // Find and update the ticket
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i]['id'] == ticketId) {
        tickets[i]['status'] = status;
        tickets[i]['updatedAt'] = DateTime.now().toIso8601String().split('T')[0];
        break;
      }
    }
    
    await prefs.setString(_ticketsKey, jsonEncode(tickets));
  }

  // Visits methods
  Future<List<Map<String, dynamic>>> getVisits() async {
    await initializeData();
    final prefs = await SharedPreferences.getInstance();
    final visitsJson = prefs.getString(_visitsKey) ?? '[]';
    return List<Map<String, dynamic>>.from(jsonDecode(visitsJson));
  }

  Future<void> createVisit(Map<String, dynamic> visitData) async {
    final prefs = await SharedPreferences.getInstance();
    final visitsJson = prefs.getString(_visitsKey) ?? '[]';
    final visits = List<Map<String, dynamic>>.from(jsonDecode(visitsJson));
    
    visits.add(visitData);
    await prefs.setString(_visitsKey, jsonEncode(visits));
  }

  // Payments methods
  Future<List<Map<String, dynamic>>> getPayments() async {
    await initializeData();
    final prefs = await SharedPreferences.getInstance();
    final paymentsJson = prefs.getString(_paymentsKey) ?? '[]';
    return List<Map<String, dynamic>>.from(jsonDecode(paymentsJson));
  }

  Future<void> clearTechnicianData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_technicianIdKey);
    await prefs.remove(_technicianNameKey);
    await prefs.remove(_technicianPhoneKey);
  }
}