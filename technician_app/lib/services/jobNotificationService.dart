import 'package:firebase_database/firebase_database.dart';
import 'jobAlertService.dart';
import 'package:shared_preferences/shared_preferences.dart';

class JobNotificationService {
  static final JobNotificationService _instance = JobNotificationService._internal();
  
  final DatabaseReference _jobsRef = FirebaseDatabase.instance.ref('jobs');
  final JobAlertService _alertService = JobAlertService();
  StreamSubscription? _jobStreamSubscription;
  Set<String> _notifiedJobIds = {};

  factory JobNotificationService() {
    return _instance;
  }

  JobNotificationService._internal();

  /// Initialize job monitoring for a technician
  Future<void> initializeJobMonitoring(String technicianId) async {
    // Load previously notified jobs from local storage
    await _loadNotifiedJobs();

    // Listen for new jobs assigned to this technician
    _jobStreamSubscription = _jobsRef
        .orderByChild('assignedTechnicianId')
        .equalTo(technicianId)
        .onValue
        .listen((event) async {
      if (event.snapshot.exists) {
        final Map<dynamic, dynamic> jobs =
            event.snapshot.value as Map<dynamic, dynamic>;

        jobs.forEach((jobId, jobData) {
          final Map<dynamic, dynamic> job = jobData as Map<dynamic, dynamic>;
          final bool isNotified = job['notified'] ?? false;
          final String status = job['status'] ?? 'pending';

          // Trigger alert only if:
          // 1. Job is NOT notified yet
          // 2. Job status is 'assigned' or 'pending' (not completed/cancelled)
          // 3. We haven't notified this job before in this session
          if (!isNotified && 
              (status == 'assigned' || status == 'pending') &&
              !_notifiedJobIds.contains(jobId)) {
            
            _triggerNewJobAlert(jobId, technicianId);
          }
        });
      }
    });

    print('✅ Job Monitoring Initialized for Technician: $technicianId');
  }

  /// Trigger alert sound for new job
  Future<void> _triggerNewJobAlert(String jobId, String technicianId) async {
    _notifiedJobIds.add(jobId);
    
    // Start alert sound loop
    await _alertService.startJobAlert(jobId);

    // Save to local storage
    await _saveNotifiedJob(jobId);

    print('🔔 NEW JOB ALERT: $jobId');
  }

  /// Stop alert and mark job as notified in database
  Future<void> acknowledgeJobAlert(String jobId) async {
    // Stop sound immediately
    await _alertService.stopJobAlert();

    // Update Firebase to mark job as notified
    try {
      await _jobsRef.child(jobId).update({
        'notified': true,
        'notifiedAt': DateTime.now().toIso8601String(),
      });
      print('✅ Job Marked as Notified: $jobId');
    } catch (e) {
      print('Error marking job as notified: $e');
    }
  }

  /// Stop alert when app/jobs screen is opened
  Future<void> stopCurrentAlert() async {
    if (_alertService.isAlertPlaying) {
      await _alertService.stopJobAlert();
      print('🔕 Alert Stopped - App Opened');
    }
  }

  /// Save notified job ID to local storage
  Future<void> _saveNotifiedJob(String jobId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final notifiedJobs = prefs.getStringList('notified_jobs') ?? [];
      if (!notifiedJobs.contains(jobId)) {
        notifiedJobs.add(jobId);
        await prefs.setStringList('notified_jobs', notifiedJobs);
      }
    } catch (e) {
      print('Error saving notified job: $e');
    }
  }

  /// Load notified job IDs from local storage
  Future<void> _loadNotifiedJobs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final notifiedJobs = prefs.getStringList('notified_jobs') ?? [];
      _notifiedJobIds = notifiedJobs.toSet();
      print('📋 Loaded ${_notifiedJobIds.length} previously notified jobs');
    } catch (e) {
      print('Error loading notified jobs: $e');
    }
  }

  /// Clear all notified jobs (e.g., on logout)
  Future<void> clearNotifiedJobs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('notified_jobs');
      _notifiedJobIds.clear();
      print('🗑️ Cleared notified jobs cache');
    } catch (e) {
      print('Error clearing notified jobs: $e');
    }
  }

  /// Get alert status
  bool get isAlertActive => _alertService.isAlertPlaying;

  /// Dispose and cleanup
  Future<void> dispose() async {
    await _jobStreamSubscription?.cancel();
    await _alertService.dispose();
    print('🛑 Job Notification Service Disposed');
  }
}
