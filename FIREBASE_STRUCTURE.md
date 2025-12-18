# Firebase Firestore Structure

## Collections

### users
Stores information about admins and technicians
```
{
  uid: string,
  name: string,
  email: string,
  phone: string,
  role: "admin" | "technician",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### customers
Stores customer information
```
{
  customerId: string,
  name: string,
  phone: string,
  email: string,
  address: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### tickets
Stores service tickets/complaints
```
{
  ticketId: string,
  customerId: string,
  title: string,
  description: string,
  status: "open" | "assigned" | "in_progress" | "completed" | "closed",
  priority: "low" | "medium" | "high",
  assignedTo: string, // technician UID
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### visits
Stores job visit information
```
{
  visitId: string,
  ticketId: string,
  technicianId: string,
  startTime: timestamp,
  endTime: timestamp,

  
  workDone: string,
  partsUsed: array,
  beforePhotos: array,
  afterPhotos: array,
  customerSignature: string, // base64 encoded
  status: "started" | "completed",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### payments
Stores payment information
```
{
  paymentId: string,
  visitId: string,
  ticketId: string,
  technicianId: string,
  amount: number,
  paymentMethod: "cash" | "upi",
  upiReferenceId: string,
  status: "pending" | "completed",
  createdAt: timestamp,
  updatedAt: timestamp
}
```