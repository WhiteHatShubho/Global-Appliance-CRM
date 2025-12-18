import 'package:flutter/material.dart';
import 'package:firebase_database/firebase_database.dart';
import '../services/local_storage_service.dart';
import 'job_details_screen.dart';

class TodayJobsScreen extends StatefulWidget {
  const TodayJobsScreen({super.key});

  @override
  State<TodayJobsScreen> createState() => _TodayJobsScreenState();
}

class _TodayJobsScreenState extends State<TodayJobsScreen> {
  late Future<List<Map<String, dynamic>>> _jobsFuture;
  final _database = FirebaseDatabase.instance.ref();
  final _storage = LocalStorageService();

  @override
  void initState() {
    super.initState();
    _jobsFuture = _loadJobs();
  }

  Future<List<Map<String, dynamic>>> _loadJobs() async {
    try {
      // Get technician ID from local storage
      final techId = await _storage.getTechnicianId();
      if (techId == null) {
        return [];
      }

      // Fetch tickets assigned to this technician
      final snapshot = await _database
          .child('tickets')
          .orderByChild('assignedToId')
          .equalTo(techId)
          .get();

      if (!snapshot.exists) {
        return [];
      }

      final jobs = <Map<String, dynamic>>[];
      final ticketsData = snapshot.value as Map<dynamic, dynamic>;

      ticketsData.forEach((key, ticket) {
        // Only show tickets that are not completed or closed
        final status = ticket['status'] ?? 'assigned';
        if (status != 'completed' && status != 'closed') {
          jobs.add({
            'id': key,
            'customer': ticket['customerName'] ?? 'Unknown',
            'address': ticket['address'] ?? 'Address not provided',
            'time': ticket['scheduledTime'] ?? 'Time TBD',
            'status': status,
            'title': ticket['title'] ?? 'Service',
            'description': ticket['description'] ?? '',
            'priority': ticket['priority'] ?? 'medium',
          });
        }
      });

      return jobs;
    } catch (e) {
      print('Error loading jobs: $e');
      return [];
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _jobsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(child: Text('Error: ${snapshot.error}'));
        }

        final jobs = snapshot.data ?? [];

        if (jobs.isEmpty) {
          return const Center(child: Text('No jobs assigned for today'));
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16.0),
          itemCount: jobs.length,
          itemBuilder: (context, index) {
            final job = jobs[index];
            return Card(
              child: ListTile(
                title: Text(job['customer']!),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(job['address']!),
                    Text('Scheduled: ${job['time']}'),
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: job['status'] == 'in_progress'
                            ? Colors.orange.withOpacity(0.2)
                            : Colors.blue.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        job['status'] == 'in_progress' ? 'In Progress' : 'Assigned',
                        style: TextStyle(
                          color: job['status'] == 'in_progress'
                              ? Colors.orange
                              : Colors.blue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                trailing: const Icon(Icons.arrow_forward_ios),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => JobDetailsScreen(ticketId: job['id']!),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}
