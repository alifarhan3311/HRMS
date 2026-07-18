/**
 * features/employees/components/EmployeeForm.jsx
 * Full multi-section create / edit form for employees.
 * Tabs: Personal Info → Contact → Employment → Professional → Account
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Briefcase, GraduationCap, Lock,
  Plus, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { ModalFooter } from '../../../components/ui/Modal';

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'professional', label: 'Professional', icon: GraduationCap },
  { id: 'account', label: 'Account', icon: Lock },
];

const GENDERS = ['male', 'female', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin'];

const EMPTY_FORM = {
  // Personal
  fullName: '',
  fatherName: '',
  cnic: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  bloodGroup: '',
  // Contact
  email: '',
  contactNumber: '',
  address: '',
  emergencyContact: '',
  // Employment
  employeeCode: '',
  joiningDate: '',
  department: '',
  designation: '',
  role: 'employee',
  managerId: '',
  teamLeadId: '',
  employeeCardNumber: '',
  insuranceCardNumber: '',
  currentSalary: '',
  // Professional
  qualification: '',
  experience: '',
  skills: [],
  // Account
  password: '',
  confirmPassword: '',
};

export default function EmployeeForm({ initial = null, onSubmit, onClose, isLoading, managers = [], teamLeads = [] }) {
  const isEdit = !!initial;
  const [activeTab, setActiveTab] = useState('personal');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');

  // Populate form in edit mode
  useEffect(() => {
    if (initial) {
      setForm({
        ...EMPTY_FORM,
        ...initial,
        dateOfBirth: initial.dateOfBirth ? initial.dateOfBirth.substring(0, 10) : '',
        joiningDate: initial.joiningDate ? initial.joiningDate.substring(0, 10) : '',
        managerId: initial.managerId?._id || initial.managerId || '',
        teamLeadId: initial.teamLeadId?._id || initial.teamLeadId || '',
        skills: initial.skills || [],
        password: '',
        confirmPassword: '',
      });
    }
  }, [initial]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) {
      set('skills', [...form.skills, s]);
    }
    setSkillInput('');
  }

  function removeSkill(skill) {
    set('skills', form.skills.filter((s) => s !== skill));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.joiningDate) e.joiningDate = 'Joining date is required';
    if (!isEdit) {
      if (!form.employeeCode.trim()) e.employeeCode = 'Employee code is required';
      if (!form.password) e.password = 'Password is required';
      else if (form.password.length < 8) e.password = 'Minimum 8 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
        e.password = 'Need uppercase, lowercase, and number';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (form.cnic && !/^\d{5}-\d{7}-\d$/.test(form.cnic))
      e.cnic = 'Format: XXXXX-XXXXXXX-X';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      // Navigate to first tab with error
      const tabFieldMap = {
        personal: ['fullName', 'fatherName', 'cnic', 'dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup'],
        contact: ['email', 'contactNumber', 'address', 'emergencyContact'],
        employment: ['employeeCode', 'joiningDate', 'department', 'designation', 'role'],
        professional: ['qualification', 'experience'],
        account: ['password', 'confirmPassword'],
      };
      for (const [tab, fields] of Object.entries(tabFieldMap)) {
        if (fields.some((f) => errors[f])) { setActiveTab(tab); break; }
      }
      return;
    }
    const payload = { ...form };
    delete payload.confirmPassword;
    if (isEdit) delete payload.password;
    // Optional MongoDB references must be null (not an empty string) when the
    // user chooses "No Manager" or "No Team Lead".
    payload.managerId = payload.managerId || null;
    payload.teamLeadId = payload.teamLeadId || null;
    onSubmit(payload);
  }

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);

  function goNext() {
    if (tabIndex < TABS.length - 1) setActiveTab(TABS[tabIndex + 1].id);
  }
  function goPrev() {
    if (tabIndex > 0) setActiveTab(TABS[tabIndex - 1].id);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-border overflow-x-auto shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
                ${isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* PERSONAL TAB */}
            {activeTab === 'personal' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <Input
                    label="Full Name" required
                    placeholder="Muhammad Ali Khan"
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    error={errors.fullName}
                  />
                </div>
                <Input
                  label="Father's Name"
                  placeholder="Muhammad Khan"
                  value={form.fatherName}
                  onChange={(e) => set('fatherName', e.target.value)}
                  error={errors.fatherName}
                />
                <Input
                  label="CNIC"
                  placeholder="42101-1234567-1"
                  value={form.cnic}
                  onChange={(e) => set('cnic', e.target.value)}
                  error={errors.cnic}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                  error={errors.dateOfBirth}
                />
                <Select
                  label="Gender"
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  <option value="">Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                  ))}
                </Select>
                <Select
                  label="Marital Status"
                  value={form.maritalStatus}
                  onChange={(e) => set('maritalStatus', e.target.value)}
                >
                  <option value="">Select status</option>
                  {MARITAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </Select>
                <Select
                  label="Blood Group"
                  value={form.bloodGroup}
                  onChange={(e) => set('bloodGroup', e.target.value)}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
            )}

            {/* CONTACT TAB */}
            {activeTab === 'contact' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <Input
                    label="Email Address" required type="email"
                    placeholder="employee@company.com"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    error={errors.email}
                    disabled={isEdit}
                  />
                </div>
                <Input
                  label="Contact Number"
                  placeholder="+92 300 1234567"
                  value={form.contactNumber}
                  onChange={(e) => set('contactNumber', e.target.value)}
                  error={errors.contactNumber}
                />
                <Input
                  label="Emergency Contact"
                  placeholder="+92 300 7654321"
                  value={form.emergencyContact}
                  onChange={(e) => set('emergencyContact', e.target.value)}
                />
                <div className="col-span-2">
                  <Textarea
                    label="Home Address"
                    placeholder="House #, Street, City, Province"
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* EMPLOYMENT TAB */}
            {activeTab === 'employment' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Employee Code" required={!isEdit}
                  placeholder="ENG0001"
                  value={form.employeeCode}
                  onChange={(e) => set('employeeCode', e.target.value)}
                  error={errors.employeeCode}
                  disabled={isEdit}
                />
                <Input
                  label="Joining Date" required type="date"
                  value={form.joiningDate}
                  onChange={(e) => set('joiningDate', e.target.value)}
                  error={errors.joiningDate}
                />
                <Input
                  label="Department"
                  placeholder="Engineering"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                />
                <Input
                  label="Designation"
                  placeholder="Software Engineer"
                  value={form.designation}
                  onChange={(e) => set('designation', e.target.value)}
                />
                <Select
                  label="Role" required
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Current Salary (PKR)"
                  placeholder="50000"
                  type="number"
                  value={form.currentSalary}
                  onChange={(e) => set('currentSalary', e.target.value)}
                />
                {managers.length > 0 && (
                  <Select
                    label="Reporting Manager"
                    value={form.managerId}
                    onChange={(e) => set('managerId', e.target.value)}
                  >
                    <option value="">No Manager</option>
                    {managers.map((m) => (
                      <option key={m._id} value={m._id}>{m.fullName} ({m.designation})</option>
                    ))}
                  </Select>
                )}
                {teamLeads.length > 0 && (
                  <Select
                    label="Team Lead"
                    value={form.teamLeadId}
                    onChange={(e) => set('teamLeadId', e.target.value)}
                  >
                    <option value="">No Team Lead</option>
                    {teamLeads.map((t) => (
                      <option key={t._id} value={t._id}>{t.fullName}</option>
                    ))}
                  </Select>
                )}
                <Input
                  label="Employee Card Number"
                  placeholder="EC-00123"
                  value={form.employeeCardNumber}
                  onChange={(e) => set('employeeCardNumber', e.target.value)}
                />
                <Input
                  label="Insurance Card Number"
                  placeholder="INS-00456"
                  value={form.insuranceCardNumber}
                  onChange={(e) => set('insuranceCardNumber', e.target.value)}
                />
              </div>
            )}

            {/* PROFESSIONAL TAB */}
            {activeTab === 'professional' && (
              <div className="space-y-4">
                <Input
                  label="Qualification"
                  placeholder="BSCS, MBA, etc."
                  value={form.qualification}
                  onChange={(e) => set('qualification', e.target.value)}
                />
                <Textarea
                  label="Experience"
                  placeholder="Describe relevant work experience..."
                  value={form.experience}
                  onChange={(e) => set('experience', e.target.value)}
                  rows={4}
                />
                {/* Skills */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Skills</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a skill and press Enter"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={addSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {form.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {form.skills.map((skill) => (
                        <span
                          key={skill}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="ml-0.5 rounded-full hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                {isEdit ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Password changes are done through the employee's own profile settings or the
                    reset password flow. This form does not expose password update.
                  </div>
                ) : (
                  <>
                    <Input
                      label="Initial Password" required type="password"
                      placeholder="Min 8 chars, uppercase + number"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      error={errors.password}
                    />
                    <Input
                      label="Confirm Password" required type="password"
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      onChange={(e) => set('confirmPassword', e.target.value)}
                      error={errors.confirmPassword}
                    />
                    <p className="text-xs text-muted-foreground">
                      The employee can change this password after first login.
                      Minimum 8 characters with at least one uppercase letter and one number.
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <ModalFooter>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground">
            Step {tabIndex + 1} of {TABS.length}
          </span>
          <div className="flex gap-1">
            {TABS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-5 rounded-full transition-colors ${i <= tabIndex ? 'bg-primary' : 'bg-border'}`}
              />
            ))}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        {tabIndex > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={goPrev}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
        )}
        {tabIndex < TABS.length - 1 ? (
          <Button type="button" variant="primary" size="sm" onClick={goNext}>
            Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Employee'}
          </Button>
        )}
      </ModalFooter>
    </form>
  );
}
