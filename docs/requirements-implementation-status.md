# HRMS Requirements Coverage

Source: `HR Management System Requirements.pdf` (14 pages, 26 sections).

Status legend: **Implemented**, **Partial**, **Missing**.

| # | Requirement area | Status | Main gaps / next acceptance target |
|---|---|---|---|
| 1 | Role dashboards | Partial | Resignations, documents, activity logs, sales and richer admin financial widgets |
| 2 | Six user roles | Implemented | Finance role removed by stakeholder decision; Admin owns financial operations |
| 3 | Employee management | Partial | Documents and complete exit workflow |
| 4 | Attendance | Partial | Automatic absences, missing punch automation, QR, face and biometric integrations |
| 5 | Late policy | Implemented | Late waiver/time correction requests, assigned approver, named reviewer, notifications and applied adjustments |
| 6 | Leave management | Partial | Anniversary carry-forward, delayed-application reminders and encashment |
| 7 | Payroll and salary | Partial | Payslip PDF, loans, tax reports and bank export |
| 8 | Expenses | Partial | Categories, invoice storage and full analytics exports |
| 9 | Public holidays | Partial | Weekend settings and proactive notifications |
| 10 | Notifications | Partial | Persistent app-wide real-time Socket.IO delivery, unread badge, toast and optional sound are implemented; email and WhatsApp delivery remain |
| 11 | Recruitment | Missing | Full module |
| 12 | Onboarding | Missing | Checklist, documents, welcome email and orientation |
| 13 | Document management | Missing | Secure upload, download, metadata and access control |
| 14 | Team lead / manager | Partial | Daily logs, assignments, evaluations, feedback and approvals |
| 15 | Sales | Missing | Leads, targets, approvals and payroll incentives |
| 16 | Performance | Missing | Reviews, ratings, feedback and self-assessment |
| 17 | Training | Missing | Courses, daily status, feedback and certificates |
| 18 | Engagement | Missing | Suggestions, complaints, grievances, appreciation and surveys |
| 19 | Assets | Missing | Assignment, inventory and exit return process |
| 20 | Resignation and exit | Missing | Approval, clearance, settlement and letters |
| 21 | Reports | Partial | Complete domain reports plus PDF and Excel export |
| 22 | Company settings | Partial | Persisted policies are live; binary logo upload and outbound email test remain |
| 23 | Audit logs | Implemented | Add UI filters/export as a reporting enhancement |
| 24 | Employee self service | Partial | Profile requests, documents, resignation, complaints, assets and reviews |
| 25 | Advanced features | Partial | Integrations, bulk operations, backup/restore and anniversary automation |
| 26 | Software house features | Partial | Assignments, tasks, work logs, timesheets, revenue and payroll incentives |

## Delivery order

1. Foundation: notifications, company policies, audit trail, files and scheduled jobs.
2. Workforce rules: attendance completion, late requests, leave automation and ESS.
3. Admin financial operations: payroll documents/exports, loans, incentives, expense categories/reports.
4. Employee lifecycle: recruitment, onboarding, documents, assets, resignation/exit.
5. Work management: manager logs, sales, projects, timesheets and productivity.
6. People development: performance, training and engagement.
7. Advanced integrations: QR, biometric, face, WhatsApp, AI analytics and backups.

## Phase 1 assumptions

- Leave anniversary is the employee's joining month/day.
- On that anniversary, unused paid, casual, sick and annual balances carry into the
  new cycle and the standard entitlement is added; `used` resets to zero.
- A delayed leave reminder is generated when an `absent` attendance day is at
  least three calendar days old and no pending/approved leave overlaps that day.
- Saturday and Sunday are the default weekends until persisted company settings
  replace the default.
