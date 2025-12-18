import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  
  // Configure Firebase Database - conditional for web compatibility
  if (!kIsWeb) {
    FirebaseDatabase.instance.setPersistenceEnabled(true);
  }
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Technician App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: const LoginScreen(),
      routes: {
        '/home': (context) => const HomeScreen(),
      },
    );
  }
}