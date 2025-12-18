import 'package:flutter/material.dart';
import 'today_jobs_screen.dart';
import '../services/local_storage_service.dart';
import '../services/jobNotificationService.dart';
import 'package:firebase_auth/firebase_auth.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentIndex = 0;
  late JobNotificationService _notificationService;
  late LocalStorageService _storage;
  String? _technicianId;

  final List<Widget> _children = [
    const TodayJobsScreen(),
    const Center(child: Text('History Screen')),
    const Center(child: Text('Profile Screen')),
  ];

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
    
    // Stop alert when user navigates to jobs screen
    if (index == 0) {
      _notificationService.stopCurrentAlert();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _storage = LocalStorageService();
    _notificationService = JobNotificationService();
    _initializeJobNotifications();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Stop alert when app comes to foreground
    if (state == AppLifecycleState.resumed) {
      print('📲 App Resumed - Stopping Alert if Active');
      _notificationService.stopCurrentAlert();
    }
  }

  Future<void> _initializeJobNotifications() async {
    try {
      // Get technician ID from Firebase auth or local storage
      final user = FirebaseAuth.instance.currentUser;
      _technicianId = user?.uid ?? await _storage.getTechnicianId();
      
      if (_technicianId != null) {
        await _notificationService.initializeJobMonitoring(_technicianId!);
        print('✅ Job Notifications Initialized');
      }
    } catch (e) {
      print('Error initializing job notifications: $e');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notificationService.dispose();
    super.dispose();
  }

  void _logout() async {
    // Stop alert before logout
    await _notificationService.stopCurrentAlert();
    
    // Clear technician data from local storage
    await _storage.clearTechnicianData();
    await _notificationService.clearNotifiedJobs();
    
    // Navigate to login screen and remove all other routes
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Technician Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: _children[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.work),
            label: 'Today\'s Jobs',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'History',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}