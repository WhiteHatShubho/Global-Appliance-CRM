import 'package:flutter/material.dart';
import 'job_complete_screen.dart';

class JobDetailsScreen extends StatelessWidget {
  final String ticketId;

  const JobDetailsScreen({super.key, required this.ticketId});

  @override
  Widget build(BuildContext context) {
    // Sample data - in a real app this would come from Firebase
    final jobDetails = {
      'id': ticketId,
      'customer': 'John Doe',
      'phone': '+91 98765 43210',
      'address': '123 Main St, City, State 123456',
      'issue': 'Air conditioner is not cooling properly',
      'priority': 'High',
      'status': 'assigned',
    };

    return Scaffold(
      appBar: AppBar(
        title: Text('Job Details - ${jobDetails['id']}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Customer Details',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text('Name: ${jobDetails['customer']}'),
                    Text('Phone: ${jobDetails['phone']}'),
                    Text('Address: ${jobDetails['address']}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Job Details',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text('Issue: ${jobDetails['issue']}'),
                    Text('Priority: ${jobDetails['priority']}'),
                    Text('Status: ${jobDetails['status']}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 30),
            Center(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => JobCompleteScreen(ticketId: ticketId),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 50, vertical: 15),
                ),
                child: const Text(
                  'Start Job',
                  style: TextStyle(fontSize: 18),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}