# HR Management System (HRMS) - Comprehensive Guide for HR

Welcome to the HRMS Official Documentation. This guide is designed to help the Human Resources team understand the core features, automation rules, and workflows of the system to manage employees smoothly.

---

## 1. System Overview & Dashboard
The system provides a centralized portal for managing employees, tracking real-time attendance, processing payroll, and handling leaves.
* **HR Action Center:** The central hub where HR can see all pending requests (Leave Approvals, Attendance Regularizations, Payroll Approvals, etc.) that require immediate attention.
* **Dashboard:** Gives a high-level view of today's attendance stats, upcoming birthdays, recent joiners, and overall company metrics.

---

## 2. Employee Management & Roles
When adding a new employee, HR defines their basic info, salary, department, and assigns a Shift.
* **Roles & Permissions:**
  * `super_admin` & `hr`: Full access to the system. Can view/edit all records, run payroll, and approve requests.
  * `manager` / `team_lead` / `floor_head`: Can view and approve requests only for their assigned subordinates.
  * `employee`: Can view their own attendance, request leaves, and download their payslips.
* **Monthly Hour Targets:** Employees in specific departments (e.g., **Operations** and **Accounting**) operate on a target-based salary model (typically **184 hours/month**).

---

## 3. Shift Policies & Timings
Shifts determine the working days, start/end times, and penalty rules.
* **Fixed vs Flexible Shifts:** 
  * *Fixed:* Strictly requires punching in and out at set times (e.g., 09:00 AM to 06:00 PM).
  * *Flexible:* Only checks the total duration worked during the day.
* **Grace Period:** A predefined grace period (e.g., 10 or 15 minutes) is allowed. 
  * If the shift starts at 09:00 AM with a 15-min grace, an employee arriving at 09:16 AM is marked **Late**.
  * The grace period also applies to **Sign-Outs** (e.g., leaving 10 minutes early might be ignored if it falls within the grace tolerance).
* **Half-Day Rules:** If an employee arrives extremely late (e.g., past the "Late Half-Day After Minutes" threshold), the system automatically converts their attendance to a **Half Day**.

---

## 4. Attendance & Nightly Automation
Attendance is primarily fetched from Biometric devices (ZKTeco) but can also be marked manually by HR or via Web Punch.

### 🌙 Nightly HR Automation (The Brain of the System)
Every night at 12:00 AM (midnight), the system runs an automated audit for the previous day. This automation ensures no manual effort is required to track absentees:
1. **Absent Marking:** Anyone who was scheduled to work but has **0 punches** is automatically marked as **Absent**.
2. **Missing Sign-Outs:** If an employee signed in but forgot to sign out, the system marks the record as **Half Day** (assuming no hours were worked) or closes it with a penalty.
3. **Late Count & Deductions:** The system calculates how many times an employee has been late. Usually, **3 Lates = 1 Day Deduction**.
4. **Saturday Policy:** Saturdays have a special exception. If an employee signs in on a Saturday, the system will mark them as **Present**, avoiding automatic half-day conversions even if they work fewer hours.

---

## 5. Regularization (Attendance Correction)
Employees often forget to punch out, or the biometric device fails to register them.
* **How it works:** Instead of HR fixing it manually, the employee submits a **Regularization Request** from their portal.
* **Types of Requests:**
  * *Time Correction:* Asking HR to manually enter their missing Sign-Out time (e.g., 06:00 PM).
  * *Late Waiver:* Asking HR to forgive a "Late" mark due to genuine reasons (traffic, client meeting).
* **HR Approval:** Once HR or the Manager approves the request, the system recalculates the hours, removes any applied penalties, and fixes the attendance status instantly.

---

## 6. Leave Management
Employees apply for leaves which go through a Manager/HR approval pipeline.
* **Leave Types:** Paid (Annual/Sick) and Unpaid.
* **Sandwich Leave Rule:** The system strictly monitors weekends and holidays.
  * If an employee takes an **Unpaid Leave on Friday** AND an **Unpaid Leave on Monday**, the system activates the Sandwich Rule and deducts salaries for Saturday and Sunday as well.
* **Leave Balances:** The system maintains yearly balances. Annual leaves are carried forward (or reset) based on the company's policy at the end of the year.

---

## 7. Payroll Processing & Salary Calculation
The Payroll module integrates Attendance, Leaves, Fines, and Advances to generate a final Payslip.

### 💰 Live Payroll
HR can view the "Live Payroll" at any point during the month. 
* Note: During the middle of the month, Live Payroll assumes the remaining days/hours as "Deductions". As the employee completes their days, these deductions decrease, reflecting the true salary at the month's end.

### 🕒 Salary Calculations (Two Methods)
1. **Standard Salary (Fixed Days):** 
   * Calculated on a 30-day fixed formula: `Monthly Salary / 30 = Per Day Salary`.
   * Unpaid leaves, Absences, and Lates (3 lates = 1 day) are deducted from this fixed amount.
2. **Target-Based Salary (Operations & Accounting):** 
   * Calculated based on Monthly Target Hours (e.g., 184 Hours).
   * `Per Hour Salary = (Monthly Salary / 30) / 8`.
   * At the end of the month, if the employee works less than 184 hours, the shortfall hours are deducted. If they meet the target, they receive their full salary regardless of specific late days.

### 🔄 Payroll Workflow
1. **Generate:** HR generates the payroll for a specific month (e.g., September).
2. **Review (Draft):** HR reviews the generated payslips. (If attendances are wrong, HR can delete the payroll, fix the attendance, and regenerate it).
3. **Approve:** Payroll is approved by the Super Admin.
4. **Paid/Lock:** Once paid, the payslips are locked and sent to the employees' portals.

---

## 8. Other Modules
* **Fines & Penalties:** HR can manually assign monetary fines for disciplinary reasons, which automatically deduct from the current month's payroll.
* **Holidays:** HR defines public holidays (e.g., Eid, Independence Day). The system will not mark employees as "Absent" on these dates, and the payroll will treat them as Paid Holidays.
* **Assets:** HR can assign company laptops, phones, or vehicles to employees. The system keeps track of return dates and sends notifications if an asset is overdue.
* **Expenses:** Employees can claim business expenses (e.g., travel fuel) which HR can review, approve, and reimburse either directly or via Payroll integration.
* **Resignation & Exit:** Handles notice periods, asset clearances, and final full & final (F&F) settlements.

---
*Generated by the HRMS System Documentation Generator.*
