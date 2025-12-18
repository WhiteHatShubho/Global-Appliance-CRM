import 'package:flutter/material.dart';
import 'package:firebase_database/firebase_database.dart';
import '../services/firebase_test.dart';
import '../services/local_storage_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String _errorMessage = '';
  final _database = FirebaseDatabase.instance.ref();
  final _storage = LocalStorageService();

  void _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter email and password';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Search for technician by email
      final snapshot = await _database
          .child('technicians')
          .orderByChild('email')
          .equalTo(_emailController.text)
          .get();

      if (!snapshot.exists) {
        throw Exception('Email not registered');
      }

      // Get technician data
      final technicians = snapshot.value as Map<dynamic, dynamic>;
      final technicianId = technicians.keys.first;
      final technicianData = technicians[technicianId] as Map<dynamic, dynamic>;
      final storedPassword = technicianData['password'] as String?;
      final technicianName = technicianData['name'] as String?;

      // Verify password
      if (storedPassword == null || storedPassword != _passwordController.text) {
        throw Exception('Incorrect password');
      }

      // Save technician info locally
      await _storage.saveTechnicianId(technicianId);
      await _storage.saveTechnicianName(technicianName ?? 'Technician');
      await _storage.saveTechnicianPhone(technicianData['phone'] ?? '');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Login successful!')),
        );
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _checkLoggedInStatus();
  }

  void _checkLoggedInStatus() async {
    final storage = LocalStorageService();
    final technicianId = await storage.getTechnicianId();
    
    // If technician is already logged in, redirect to home
    if (technicianId != null && mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  void _testFirebaseConnection() async {
    setState(() {
      _isLoading = true;
    });

    final firebaseTest = FirebaseTest();
    final isConnected = await firebaseTest.testConnection();
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isConnected ? 'Firebase Connected ✓' : 'Firebase Failed ✗'),
        ),
      );
      setState(() {
        _isLoading = false;
      });
    }
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Technician Login'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 40),
              const Text(
                'Service Management System',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Technician Portal',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 50),
              // Error message
              if (_errorMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _errorMessage,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              if (_errorMessage.isNotEmpty) const SizedBox(height: 20),
              // Email field
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'Email',
                  hintText: 'Enter your email',
                  prefixIcon: const Icon(Icons.email),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  enabled: !_isLoading,
                ),
                keyboardType: TextInputType.emailAddress,
                onChanged: (_) {
                  setState(() => _errorMessage = '');
                },
              ),
              const SizedBox(height: 20),
              // Password field
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Password',
                  hintText: 'Enter your password',
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_off
                          : Icons.visibility,
                    ),
                    onPressed: () {
                      setState(
                        () => _obscurePassword = !_obscurePassword,
                      );
                    },
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  enabled: !_isLoading,
                ),
                obscureText: _obscurePassword,
                onChanged: (_) {
                  setState(() => _errorMessage = '');
                },
              ),
              const SizedBox(height: 30),
              // Login button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Login',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Created by Admin Panel',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _isLoading ? null : _testFirebaseConnection,
        child: const Icon(Icons.wifi),
      ),
    );
  }
}