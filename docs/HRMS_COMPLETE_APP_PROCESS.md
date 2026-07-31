# HRMS Complete Application Process

**Organization:** MH Enterprises  
**Document type:** Operational and Functional Guide  
**Last updated:** 31 July 2026

---

## 1. System Overview

This HRMS manages the complete employee lifecycle through one web application:

- Employee profiles and reporting hierarchy
- Shift assignment and attendance
- ZKTeco biometric Sign In / Sign Out
- Work From Home attendance
- Leave balances and approval
- Live salary and monthly payroll
- Company expenses
- Department-specific projects and tasks
- Notifications, reports and exports
- Role-based access control and audit history

The frontend is built with React, Redux Toolkit, Tailwind CSS and Vite. The backend uses Node.js, Express and MongoDB/Mongoose. Socket.IO provides live updates.

---

## 2. User Roles and Hierarchy

The employee reporting hierarchy is:

```text
Manager
  -> Floor Head (when assigned)
      -> Team Lead
          -> Employee
```

If a department has no Floor Head, the Team Lead reports directly to the Manager.

### Roles

| Role | Main access |
|---|---|
| Super Admin | Company-wide administration, HR data, payroll, reports and settings |
| Admin | Authorized dashboard, payroll and reports |
| HR | Employee management, attendance control, leaves, payroll, expenses, reports and settings |
| Manager | Assigned departments and teams; team attendance and department project views |
| Floor Head | Assigned hierarchy and team visibility where enabled |
| Team Lead | Employees assigned under their team and relevant approval workflows |
| Employee | Own attendance, leave, payroll, notifications and department-specific work |

Permissions are enforced in both the frontend and backend APIs. Hiding a button is not the only security layer.

### Multi-Department Manager

A single Manager account can manage multiple departments through `managedDepartments`. The same person must not be duplicated for different departments because this would split login, attendance, leaves and payroll records.

### Human Resources Department

Human Resources remains available internally for system operation, but it is hidden from employee-assignment department dropdowns and team-structure tabs where configured.

---

## 3. Authentication and Session Process

1. User enters email and password.
2. Backend validates the active employee account.
3. Access and refresh tokens are created.
4. `/api/v1/auth/me` loads the current profile and permissions.
5. A separate short-lived Socket.IO token connects live updates.
6. On logout, the complete interface is frozen until session termination finishes.
7. Expired access tokens are renewed through the refresh-token flow.

If `/auth/me` returns HTTP 500 immediately after local development changes, confirm that the backend is running correctly and restart the backend process before changing authentication code.

---

## 4. Employee Management

Authorized HR users can:

- Add, edit, deactivate or delete employees according to permissions
- Assign Employee ID, designation, department and joining date
- Assign Manager, Floor Head and Team Lead
- Assign Office or Work From Home mode
- Assign fixed or flexible shift
- Set monthly salary and payment information
- Set biometric device user ID
- Promote or transfer an employee
- Maintain leave opening balances

### Salary Payment Information

Employee payment details include:

- Payment method/bank
- Account number
- Account title

Pakistan payment methods such as bank transfer, Easypaisa and JazzCash can be selected where configured.

### Department Management

HR can add or remove departments. A department cannot be deleted while active employees are assigned to it.

### Biometric Mapping

The machine User ID must exactly match the employee's **Biometric Device User ID**.

Example:

```text
Machine User ID: 25
HRMS Biometric Device User ID: 25
```

Duplicate biometric IDs are not allowed within the company.

---

## 5. Attendance Process

### Office Employees

Office employees mark attendance through the ZKTeco biometric machine. The web Sign In button is hidden for Office employees.

### Work From Home Employees

Only employees with `workMode = wfh` can use the web Sign In/Sign Out flow. Their attendance record is stored with a WFH badge.

### Fixed Shift Rule

Attendance belongs to the employee's assigned shift. Working any random eight-hour interval does not replace the assigned shift timing.

Example:

```text
Assigned shift: 6:00 PM to 2:00 AM
Duty date: the date on which the shift starts
Sign Out after midnight: stored against the same overnight duty
```

### Shift Longer Than Seven Hours

- Arrival grace: 15 minutes
- A 6:00 PM shift becomes Late at 6:16 PM
- Half Day by late arrival: 150 minutes after scheduled start
- Completion tolerance: 15 minutes for fixed shifts longer than seven hours

### Shift of Seven Hours or Less

- No arrival grace
- One minute after scheduled start counts as Late
- Half Day by late arrival: 120 minutes after scheduled start

### Flexible Shifts

- Flexible 8-hour employee must complete 8 hours
- Flexible 6-hour employee must complete 6 hours
- No Late status is applied because arrival time is flexible
- Duty calculation still uses the open assigned shift window and correct overnight date handling

### Saturday Policy

Saturday has a special company policy:

- Only Present or Absent applies
- Any valid Sign In is enough for Present
- No Late status
- Sign Out is not required
- Saturday must not contribute to Leave Against Lates

### Missing Sign Out

For normal working days other than Saturday:

- An open attendance record remains incomplete until the permitted closure process runs
- Missing Sign Out counts as one late violation according to the configured policy
- The system must never invent worked hours or a fake scheduled Sign Out
- A later recovered valid punch clears the recovered missing-punch penalty

### Duplicate Punch Protection

Biometric punches are identified by device, user ID, timestamp, verification mode and punch status. Duplicate events cannot create duplicate attendance records.

The expected sequence is:

```text
First valid punch  -> Sign In
Valid checkout     -> Sign Out
Repeated entry     -> Ignored
Punch after closed shift -> Ignored
```

### Manual Correction and Regularization

- The selected attendance date is fixed and cannot be changed accidentally in the correction form
- Only Sign In time, Sign Out time and reason are corrected
- Overnight Sign Out automatically uses the next calendar date when needed
- Employee regularization requests retain their selected attendance date
- Authorized reporting-line approvers can review requests according to current workflow

---

## 6. ZKTeco Biometric Integration

### Device

```text
Model: ZKTeco MB20-VL
IP: 192.168.1.5
Port: 4370
Protocol: TCP/IP
```

### Timestamp Correction

The machine is intentionally configured 12 hours behind. The system preserves both values:

```text
machineTimestamp   = raw machine time
correctedTimestamp = machineTimestamp + BIOMETRIC_TIME_OFFSET_HOURS
```

All attendance calculations use `correctedTimestamp`. The offset is configured through:

```env
BIOMETRIC_TIME_OFFSET_HOURS=12
```

### Live Synchronization

1. Backend connects to the device over TCP.
2. Native real-time event subscription listens for each punch.
3. Punch is normalized and timestamp correction is applied.
4. Employee is matched through Biometric Device User ID.
5. Raw punch is stored for audit and retry.
6. Existing attendance service decides Sign In, Sign Out or ignored duplicate.
7. Attendance is saved in MongoDB.
8. Socket.IO broadcasts the update to the website.
9. Backup reconciliation checks retained machine logs.

Required environment settings:

```env
ZKTECO_ENABLED=true
ZKTECO_IP=192.168.1.5
ZKTECO_PORT=4370
ZKTECO_NATIVE_REALTIME=true
ZKTECO_RECONCILE_INTERVAL=300000
BIOMETRIC_TIME_OFFSET_HOURS=12
```

Normal live attendance should appear within approximately 5–15 seconds. Backup reconciliation handles missed live events. Failed and unmapped punches remain auditable and retryable.

### Deployment Requirement

A VPS cannot directly reach private IP `192.168.1.5` unless one of these exists:

- Site-to-site/VPS-to-office VPN such as WireGuard, or
- A continuously running office sync agent/PC that can reach the machine and send punches to the VPS

Without this connection, deployed live attendance cannot receive office machine punches.

---

## 7. Leave Management

### Leave Types

Current employee balances are maintained separately for:

- Annual Leave
- Sick Leave

The leave page shows Total, Used and Remaining balances.

### Eligibility

- Normal employee leave entitlement begins after three complete calendar months of service
- Before three months, the employee cannot normally apply
- HR can record an appropriate leave exception for an eligible off-day case when authorized

### Application

- A one-day leave requires only the required single date
- Overnight shift leave is counted against the duty day on which the shift starts
- Genuine multiple-day date-only leave remains inclusive
- Employee can view Pending, Approved, Rejected or Cancelled status
- Current leave requests are sent to HR for final approval according to the approved workflow

### Leave Against Lates

- Three eligible unused Late records can be selected
- The system does not automatically create a leave after three lates
- Employee selects exactly three Late records and submits one paid leave request to HR
- Saturday records and resolved missing-punch penalties are excluded

### Sandwich Leave

If Absent/Unpaid Leave exists on both sides of weekly offs or holidays, the days between them become sandwich unpaid leave.

Example:

```text
Saturday: Absent/Unpaid Leave
Sunday: Weekly Off
Monday: Absent/Unpaid Leave

Result: all three days are deducted
```

The rule supports multiple consecutive holidays, public holidays and configured off days.

---

## 8. Payroll Process

### Daily Salary

```text
Daily Salary = Monthly Salary / 30
```

### Attendance Effect

| Attendance | Salary effect |
|---|---|
| Present | Full daily salary earned |
| Half Day | 50% daily salary |
| Absent | Full daily salary deduction |
| Paid Leave | No deduction |
| Unpaid Leave | Full daily salary deduction |
| Weekly Off/Holiday | According to paid schedule and sandwich policy |

### Late Rule

The company rule is:

```text
3 Lates = 1 full-day salary deduction
```

This is a payroll deduction. It does not automatically create a leave request.

### No Overtime

The company currently has no overtime concept. Overtime is not included in payable salary.

### Payroll Visibility

- Every authorized user can view their own payroll
- Team Leads must not see employee salary details outside their own permitted personal view
- HR/Admin/Super Admin access payroll according to configured permissions
- Manager access follows the current authorized payroll visibility

### Payroll Values

The live dashboard and monthly payroll can include:

- Monthly and daily salary
- Present, Absent and Half Days
- Paid and Unpaid Leaves
- Late count and late deduction
- Advance/loan deduction
- Manual deductions and reasons
- Bonuses and reasons
- Earned salary
- Gross salary
- Net payable salary

Attendance changes automatically invalidate and recalculate payroll/report data.

---

## 9. Expenses

HR can create expenses through a multi-row form containing:

- Date
- Product
- Quantity
- Price
- Automatically calculated total

Expenses can also be imported through an Excel file where supported. HR and Super Admin can view permitted expense records. Expense details can be shared through the configured WhatsApp number using a WhatsApp share link; this opens WhatsApp and does not require a paid WhatsApp API.

Expense categories are managed by HR. A category in active use cannot be removed without satisfying the configured validation.

---

## 10. Projects and Department Workflows

Project features are department-scoped. A Call Center workflow must not appear for Digital Media, Accounting or another department. Accounting workflow must only appear to Accounting users with the permitted roles.

### Call Center — Before Probation Completion

- Employee sees **Add Transfer**
- Monthly target: 3 approved transfers
- Fields: transfer date, transferred-to Team Lead, business owner/manager name and details
- Transferred-to dropdown contains searchable Call Center Team Leads
- Assigned Team Lead approves or rejects individual transfers
- Employee receives approval/rejection notification
- On 3 approved monthly transfers, target turns green and congratulations notification appears

### Call Center — After Probation

Employee sees **Add Sale** with:

- Date
- Business name
- Owner name
- Product
- Sale details

Available products include POS, ATM Service, Accounting, OSAP, Digital Media Service, PR and Insurance.

Targets:

| Role | Approved monthly sales target |
|---|---:|
| Employee | 2 |
| Team Lead | 5 |
| Floor Head | 15 |

Approval follows reporting hierarchy, but a sale only counts after final Manager approval.

### Accounting Tasks

Only Accounting Employee, Team Lead and Manager roles can access this workflow.

#### Employee

- Opens **Add Tasks**
- Can add multiple rows
- Fields: Date, Title and Description
- Submitted tasks go directly to the assigned Team Lead
- Employee tracks Pending, Approved and Rejected status

#### Team Lead

- Sees tasks only from employees assigned to their Accounting team
- Can approve or reject an individual pending task
- Can filter by employee, status and date range
- Can download filtered reports

#### Manager

- Sees Accounting tasks across the managed Accounting department
- View-only for task decisions
- Can filter by employee, Pending/Approved/Rejected status, daily, monthly, yearly or custom dates
- Can export CSV, Excel and PDF/Print reports

HR, Admin, Super Admin, Floor Head and other departments do not receive Accounting Task access under the approved workflow.

---

## 11. Notifications and Email

The application uses in-app notifications and live Socket.IO updates.

Examples:

- Leave submitted, approved or rejected
- Attendance regularization decision
- Call transfer or sale decision
- Accounting task submitted or decided
- Birthday reminders and wishes
- Schedule/off-day notifications where email is configured

### Birthday Automation

- Employee birthday wish is scheduled for 12:00 AM when the birthday date begins
- HR receives advance notification/email one day before
- HR also receives the configured reminder two hours before
- Email delivery requires valid SMTP environment configuration

---

## 12. Reports and Exports

Authorized reports can be filtered by:

- One employee or all permitted employees
- Month and year
- Daily, weekly, monthly or custom period where supported
- Attendance status
- Work mode
- Leave type/status
- Payroll or deduction data according to permission

Exports include:

- Excel
- CSV
- PDF/Print

Reports must display formatted rows and columns, not raw JSON data.

---

## 13. Live Updates and Cache Refresh

When attendance, leave, payroll, employee, expense, project or Accounting task data changes:

1. Backend saves the change.
2. Socket.IO broadcasts a scoped change event.
3. Redux Toolkit Query invalidates relevant cache tags.
4. Visible pages refetch updated data.
5. User sees the result without manually refreshing the page.

Socket.IO deployment behind Nginx/Kubernetes requires WebSocket forwarding and either sticky sessions for polling or websocket-only architecture according to deployment configuration.

---

## 14. Settings

HR and Super Admin can manage available settings such as:

- Shifts and flexible schedules
- Holidays and emergency office schedules
- Company off days
- Leave entitlements/opening balances
- Payroll rules
- Expense categories

Changes should be made through APIs and stored in MongoDB. Employee-specific or company operational data must not be hardcoded in the frontend.

---

## 15. Daily HR Operating Checklist

### Start of Day

1. Confirm backend and database are connected.
2. Confirm biometric status shows TCP connected and native realtime active.
3. Confirm attendance page loads without duplicate employee/date records.
4. Review unmapped biometric IDs.
5. Review pending leave and regularization requests.

### During the Day

1. Add/update employees, hierarchy and shifts when authorized.
2. Review attendance exceptions rather than changing dates.
3. Process leaves and department approvals.
4. Record expenses with correct supporting details.
5. Check notifications and failed email retries.

### End of Day/Month

1. Review missing Sign Outs and legitimate recovered punches.
2. Verify Saturday policy is not creating Late penalties.
3. Review attendance and leave reports.
4. Generate/review payroll after attendance is complete.
5. Export required Excel/PDF reports.

---

## 16. Troubleshooting

### Attendance does not appear after a punch

Check backend logs for:

```text
[zkteco] Device connected
[zkteco] Native realtime attendance subscription active
[zkteco] Attendance event received
[zkteco] Employee mapped
[zkteco] Attendance created / updated
```

If the device user is `UNMAPPED`, assign the exact machine User ID to the employee.

### `TIME OUT !! PACKETS REMAIN`

The device did not complete a large historical log transfer. Native realtime remains the primary channel; backup reconciliation uses a durable timestamp cursor and duplicate fingerprints.

### `/api/v1/auth/me` returns 500 locally

1. Confirm backend port is running.
2. Confirm MongoDB connection.
3. Restart the backend process.
4. Retry login/session loading.
5. Only inspect auth code if the server is healthy and the error persists.

### Data appears twice for the same employee/date

Attendance uses one normalized `employee + shiftDate` identity. Run the approved attendance duplicate repair procedure only after taking a database backup and confirming affected records.

---

## 17. Production Deployment Checklist

- Set production MongoDB URI
- Set encryption master key consistently across all instances
- Set JWT/access/refresh secrets consistently
- Configure frontend API URL and allowed origins
- Configure Socket.IO/Nginx WebSocket forwarding
- Use sticky sessions if Socket.IO polling runs across multiple replicas
- Configure SMTP for emails
- Configure ZKTeco variables
- Provide VPN or office sync agent connectivity to `192.168.1.5:4370`
- Run one biometric worker instance per physical device
- Restart backend after environment changes
- Verify `/api/v1/auth/me`, Socket.IO, device status and one physical Sign In/Sign Out
- Confirm database backups and monitoring

---

## 18. Modules Marked Coming Soon

The current navigation identifies these modules as not yet fully active:

- Recruitment
- Training
- Assets
- Sales standalone module
- Engagement
- Documents

They should not be treated as completed operational modules until separately implemented and approved.

---

## 19. Change-Control Rule

Completed attendance, payroll, leave and department workflows are treated as locked. Before changing an existing approved rule:

1. Explain the requested change and affected modules.
2. Explain data/payroll/report impact.
3. Obtain approval.
4. Implement the minimum scoped change.
5. Run regression tests.
6. Test the relevant real workflow before deployment.

