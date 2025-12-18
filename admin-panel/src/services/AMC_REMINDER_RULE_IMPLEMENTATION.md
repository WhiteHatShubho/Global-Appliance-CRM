# AMC SERVICE REMINDER RULE IMPLEMENTATION

## CORE RULE
**AMC service reminders are calculated based on LAST SERVICE DATE, BUT the AMC END DATE / RENEWAL DATE remains FIXED.**

---

## IMPLEMENTATION DETAILS

### 1. AMC Data Structure
Every AMC customer now stores an `amc` object:

```javascript
amc: {
  startDate,            // FIXED - AMC coverage start date (YYYY-MM-DD)
  endDate,              // FIXED - AMC coverage end date (YYYY-MM-DD)
  intervalMonths: 3,    // Interval between services (default: 3 months)
  totalServices: 4,     // Total number of services in AMC cycle
  servicesCompleted: 0, // Counter of completed services
  lastServiceDate: null,// Date of last completed service (YYYY-MM-DD)
  nextServiceDate: null,// Next scheduled service date (calculated)
  isActive: true        // AMC active status
}
```

**Key Rule**: `startDate` and `endDate` NEVER change even if services are rescheduled or completed late.

---

### 2. Service Completion Flow

When a service is completed:

1. **Mark Service as Completed**
   - Service status → 'completed'
   - Store completedAt timestamp

2. **Update Customer AMC Data**
   - `lastServiceDate` = actual completion date
   - `nextServiceDate` = lastServiceDate + intervalMonths
   - `servicesCompleted` += 1
   - **AMC endDate REMAINS UNCHANGED**

3. **Check AMC Deactivation**
   - If `servicesCompleted >= totalServices` OR `currentDate > endDate`
   - Set `isActive = false`
   - Stop showing service reminders
   - Show renewal reminder instead

**Code Location**: `AMCServices.js` → `handleMarkComplete()`

---

### 3. Service Reminder Logic

#### When to Show AMC Service Reminder:

Show reminder IF ALL conditions are met:
- `amc.isActive === true`
- `amc.nextServiceDate` is set
- `currentDate >= amc.nextServiceDate`
- `currentDate <= amc.endDate`

#### When to Show AMC Renewal Reminder:

Show reminder IF EITHER condition is met:
- `servicesCompleted >= totalServices` (all 4 services done)
- `currentDate > amc.endDate` (renewal date passed)

**Code Location**: `amcReminderService.js`

---

### 4. Files Created/Modified

#### NEW FILES:
1. **`amcReminderService.js`** (324 lines)
   - Core logic for AMC reminder calculations
   - Methods:
     - `processServiceCompletion()` - Update lastServiceDate & nextServiceDate
     - `shouldShowServiceReminder()` - Check if service reminder should display
     - `shouldShowRenewalReminder()` - Check if renewal reminder should display
     - `checkAndDeactivateAMC()` - Deactivate AMC when conditions met
     - `validateAMC()` - Validate AMC structure
     - `getAMCStatus()` - Get complete AMC status summary

#### MODIFIED FILES:

1. **`AIAgent.js`** (Reminder/Notification Tab)
   - Import: `amcReminderService`
   - Updated `loadReminders()` function:
     - Added AMC_SERVICE_REMINDER check using `shouldShowServiceReminder()`
     - Separated AMC_RENEWAL from old logic
     - Uses new service reminder rule

2. **`AMCServices.js`** (AMC Services Tab)
   - Import: `amcReminderService`
   - Updated `handleMarkComplete()` function:
     - Gets service details
     - Marks service as completed
     - Calls `processServiceCompletion()` to update AMC data
     - Calls `checkAndDeactivateAMC()` to check deactivation
     - Updates customer with new AMC data

3. **`Customers.js`** (Customer Creation)
   - Added AMC structure initialization on customer creation:
     ```javascript
     amc: {
       startDate: formData.amcStartDate,
       endDate: formData.amcEndDate,
       intervalMonths: 3,
       totalServices: 4,
       servicesCompleted: 0,
       lastServiceDate: null,
       nextServiceDate: null,
       isActive: true
     }
     ```

---

## EXAMPLE SCENARIO

**Customer**: Raj Sharma
**AMC Start**: 2024-11-01
**AMC End**: 2025-11-01 (FIXED)
**Interval**: 3 months
**Total Services**: 4

### Timeline:

| Date | Event | AMC Data | Reminder |
|------|-------|----------|----------|
| 2024-11-01 | AMC created | lastServiceDate=null, nextServiceDate=null | None |
| 2025-02-01 | 1st service due | nextServiceDate should be 2025-02-01 | Show if today >= 2025-02-01 |
| 2025-02-10 | 1st service completed (EARLY) | lastServiceDate=2025-02-10, nextServiceDate=2025-05-10 | Cancel old reminder, reschedule next |
| 2025-05-10 | 2nd service due | nextServiceDate=2025-05-10 | Show if today >= 2025-05-10 |
| 2025-05-15 | 2nd service completed | lastServiceDate=2025-05-15, nextServiceDate=2025-08-15 | Update next date |
| 2025-08-15 | 3rd service due | nextServiceDate=2025-08-15 | Show reminder |
| 2025-08-20 | 3rd service completed | lastServiceDate=2025-08-20, nextServiceDate=2025-11-20 | Update next date |
| 2025-11-01 | AMC END DATE | (still active if not 4 services) | Show renewal alert if within 30 days |
| 2025-11-20 | 4th service due | nextServiceDate=2025-11-20 | Show if before AMC end |
| 2025-11-25 | 4th service completed | servicesCompleted=4, isActive=false | Show renewal reminder, stop service reminders |
| 2025-12-01 | After AMC end + all services | isActive=false | Renewal required |

**Important**: `amc.endDate` remains **2025-11-01** throughout. It never extends even if services are delayed.

---

## STRICTLY DO NOT

- ❌ Do NOT shift AMC end / renewal date
- ❌ Do NOT regenerate AMC period based on service completion
- ❌ Do NOT use fixed calendar months for service reminders
- ❌ Do NOT change endDate when rescheduling services
- ❌ Do NOT extend AMC period automatically

---

## APPLIES GLOBALLY

This rule implementation applies across:
- ✅ AMC Service & Reminder tab (AIAgent.js)
- ✅ Service management (AMCServices.js)
- ✅ Complaint-based service completion (future integration)
- ✅ Dashboard counts (future integration)
- ✅ Customer AMC status (Customers.js)

---

## Testing

### Test Case 1: Normal Service Completion
1. Create AMC customer with startDate=today, endDate=today+1year
2. Complete 1st service with actual date = startDate + 3months
3. Verify: `lastServiceDate` = completion date, `nextServiceDate` = lastServiceDate + 3months
4. Verify: `endDate` unchanged
5. Show service reminder for 2nd service starting on `nextServiceDate`

### Test Case 2: Early Service Completion
1. Service scheduled for 2025-02-01
2. Complete on 2025-01-25 (7 days early)
3. Verify: `lastServiceDate` = 2025-01-25
4. Verify: `nextServiceDate` = 2025-04-25 (not 2025-02-01)
5. Verify: Old reminder cancelled

### Test Case 3: AMC Expiration
1. Today = 2025-11-01 (AMC end date)
2. Verify: `isActive` status evaluated
3. If `servicesCompleted < 4`: Show renewal reminder
4. If `servicesCompleted >= 4`: Show renewal reminder
5. Stop showing service reminders

---

## Status

🟢 **IMPLEMENTATION COMPLETE**

All code changes applied:
- Service file created
- Components updated
- Ready for testing

