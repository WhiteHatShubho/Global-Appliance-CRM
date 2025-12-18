class Ticket {
  final String id;
  final String customerId;
  final String title;
  final String description;
  final String status;
  final String priority;
  final String assignedTo;
  final DateTime createdAt;
  final DateTime updatedAt;

  Ticket({
    required this.id,
    required this.customerId,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.assignedTo,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) {
    return Ticket(
      id: json['id'] ?? '',
      customerId: json['customerId'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? '',
      priority: json['priority'] ?? '',
      assignedTo: json['assignedTo'] ?? '',
      createdAt: (json['createdAt'] as Timestamp).toDate(),
      updatedAt: (json['updatedAt'] as Timestamp).toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'customerId': customerId,
      'title': title,
      'description': description,
      'status': status,
      'priority': priority,
      'assignedTo': assignedTo,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}