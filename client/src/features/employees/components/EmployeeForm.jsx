/**
 * features/employees/components/EmployeeForm.jsx
 * Full multi-section create / edit form for employees.
 * Tabs: Personal Info → Contact → Employment → Professional → Account
 */
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Briefcase, GraduationCap, Lock,
  Plus, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { ModalFooter } from '../../../components/ui/Modal';
import { useListShiftsQuery } from '../../shifts/api/shifts.api';
import {
  useCreateEmployeeDepartmentMutation,
  useGetEmployeeDepartmentsQuery,
} from '../api/employees.api';
import { toast } from '../../../utils/toast';
import { useFormDraft } from '../../../hooks/useFormDraft';

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'professional', label: 'Professional', icon: GraduationCap },
  { id: 'account', label: 'Account', icon: Lock },
];

const GENDERS = ['male', 'female', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const DEFAULT_ROLES = ['employee', 'team_lead', 'floor_head', 'manager'];
const HIDDEN_CREATE_DEPARTMENTS = new Set([
  'hr', 'human resource', 'human resources', 'human resources department', 'executive',
]);
const SALARY_PAYMENT_METHODS = [
  ['allied_bank', 'Allied Bank (ABL)'], ['askari_bank', 'Askari Bank'],
  ['bank_alfalah', 'Bank Alfalah'], ['bank_al_habib', 'Bank AL Habib'],
  ['bankislami', 'BankIslami Pakistan'], ['bank_of_khyber', 'Bank of Khyber'],
  ['bank_of_punjab', 'Bank of Punjab'], ['dubai_islamic_bank', 'Dubai Islamic Bank Pakistan'],
  ['easypaisa', 'Easypaisa'], ['faysal_bank', 'Faysal Bank'],
  ['first_women_bank', 'First Women Bank'], ['habib_bank', 'Habib Bank (HBL)'],
  ['habib_metropolitan', 'Habib Metropolitan Bank'], ['jazzcash', 'JazzCash'],
  ['js_bank', 'JS Bank'], ['mcb_bank', 'MCB Bank'], ['mcb_islamic', 'MCB Islamic Bank'],
  ['meezan_bank', 'Meezan Bank'], ['national_bank', 'National Bank of Pakistan (NBP)'],
  ['nayapay', 'NayaPay'], ['sadapay', 'SadaPay'], ['sindh_bank', 'Sindh Bank'],
  ['soneri_bank', 'Soneri Bank'], ['standard_chartered', 'Standard Chartered Pakistan'],
  ['ubl', 'United Bank (UBL)'], ['upaisa', 'UPaisa'], ['zindigi', 'Zindigi'],
  ['other', 'Other Bank / Wallet'],
];

function formatCnic(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 13);
  if (!digits) return '';

  let formatted = digits.slice(0, 5);
  if (digits.length >= 5) formatted += '-';
  if (digits.length > 5) formatted += digits.slice(5, 12);
  if (digits.length >= 12) formatted += '-';
  if (digits.length > 12) formatted += digits.slice(12, 13);
  return formatted;
}
const TAB_FIELDS = {
  personal: ['fullName', 'fatherName', 'cnic', 'dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup'],
  contact: ['email', 'contactNumber', 'address', 'emergencyContact'],
  employment: [
    'joiningDate', 'department', 'workMode', 'managedDepartments', 'designation', 'role', 'managerId', 'floorHeadId', 'teamLeadId',
    'shiftId', 'currentSalary', 'salaryPaymentMethod', 'salaryAccountNumber', 'salaryAccountTitle',
  ],
  professional: ['qualification', 'experience'],
  account: ['password', 'confirmPassword'],
};
const FIELD_LABELS = {
  fullName: 'Full Name',
  cnic: 'CNIC',
  dateOfBirth: 'Date of Birth',
  email: 'Email Address',
  contactNumber: 'Contact Number',
  joiningDate: 'Joining Date',
  department: 'Department',
  workMode: 'Work Mode',
  managedDepartments: 'Managed Departments',
  role: 'Role',
  floorHeadId: 'Floor Head',
  teamLeadId: 'Team Lead',
  shiftId: 'Assigned Shift',
  currentSalary: 'Current Salary',
  salaryPaymentMethod: 'Bank / Wallet',
  salaryAccountNumber: 'Account Number',
  salaryAccountTitle: 'Account Title',
  password: 'Initial Password',
  confirmPassword: 'Confirm Password',
};

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
  workMode: 'office',
  managedDepartments: [],
  designation: '',
  role: 'employee',
  managerId: '',
  floorHeadId: '',
  teamLeadId: '',
  shiftId: '',
  employeeCardNumber: '',
  biometricDeviceUserId: '',
  insuranceCardNumber: '',
  currentSalary: '',
  salaryPaymentMethod: '',
  salaryAccountNumber: '',
  salaryAccountTitle: '',
  // Professional
  qualification: '',
  experience: '',
  skills: [],
  // Account
  password: '',
  confirmPassword: '',
};

export default function EmployeeForm({
  initial = null, onSubmit, onClose, isLoading, managers = [], floorHeads = [], teamLeads = [], allowedRoles = DEFAULT_ROLES,
}) {
  const isEdit = !!initial;
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('personal');
  const draftKey = isEdit ? null : `hrms:draft:employee:create:${user?.companyId || user?.id || 'user'}`;
  const [form, setForm, clearDraft] = useFormDraft(draftKey, EMPTY_FORM, {
    exclude: ['password', 'confirmPassword'],
  });
  const [errors, setErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');
  const [departmentCreatorOpen, setDepartmentCreatorOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [departmentError, setDepartmentError] = useState('');
  const { data: departmentsData } = useGetEmployeeDepartmentsQuery();
  const [createDepartment, { isLoading: isCreatingDepartment }] = useCreateEmployeeDepartmentMutation();
  const {
    data: shiftsData,
    isLoading: shiftsLoading,
    isError: shiftsError,
    refetch: refetchShifts,
  } = useListShiftsQuery({ active: true });
  const shifts = shiftsData?.data || [];
  const departments = [...new Set([
    ...(departmentsData?.data || []),
    ...(form.department ? [form.department] : []),
  ].map((department) => String(department).trim().toLowerCase()))]
    .filter((department) => !HIDDEN_CREATE_DEPARTMENTS.has(
      department.replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
    ))
    .sort((left, right) => left.localeCompare(right));
  const normalizedDepartment = String(form.department || '').trim().toLowerCase();
  const availableManagers = managers.filter((manager) => (
    Boolean(normalizedDepartment)
    && [
      manager.department,
      ...(manager.managedDepartments || []),
    ].some((department) => String(department || '').trim().toLowerCase() === normalizedDepartment)
  ));
  const availableTeamLeads = teamLeads.filter((lead) => (
    Boolean(normalizedDepartment)
    && String(lead.department || '').trim().toLowerCase() === normalizedDepartment
  ));
  const availableFloorHeads = floorHeads.filter((head) => (
    Boolean(normalizedDepartment)
    && String(head.department || '').trim().toLowerCase() === normalizedDepartment
  ));
  const departmentManager = availableManagers[0];

  useEffect(() => {
    if (!['employee', 'team_lead', 'floor_head'].includes(form.role)) return;
    if (departmentManager && String(form.managerId || '') !== String(departmentManager._id)) {
      setForm((previous) => ({ ...previous, managerId: departmentManager._id }));
    } else if (!departmentManager && form.managerId) {
      setForm((previous) => ({ ...previous, managerId: '', floorHeadId: '', teamLeadId: '' }));
    }
  }, [departmentManager, form.managerId, form.role]);

  useEffect(() => {
    if (!['employee', 'team_lead'].includes(form.role)) {
      if (form.teamLeadId) setForm((previous) => ({ ...previous, teamLeadId: '' }));
    }
    if (!['employee', 'team_lead'].includes(form.role) && form.floorHeadId) {
      setForm((previous) => ({ ...previous, floorHeadId: '' }));
      return;
    }
    if (form.floorHeadId && !availableFloorHeads.some((head) => String(head._id) === String(form.floorHeadId))) {
      setForm((previous) => ({ ...previous, floorHeadId: '' }));
    }
    if (form.teamLeadId && !availableTeamLeads.some((lead) => String(lead._id) === String(form.teamLeadId))) {
      setForm((previous) => ({ ...previous, teamLeadId: '' }));
    }
  }, [availableFloorHeads, availableTeamLeads, form.floorHeadId, form.role, form.teamLeadId]);

  // New employees must always have a concrete shift. Select the first active
  // company shift as soon as the async list becomes available.
  useEffect(() => {
    if (!isEdit && !form.shiftId && shifts.length > 0) {
      setForm((previous) => ({ ...previous, shiftId: shifts[0]._id }));
      setErrors((previous) => ({ ...previous, shiftId: '' }));
    }
  }, [form.shiftId, isEdit, shifts]);

  // Populate form in edit mode
  useEffect(() => {
    if (initial) {
      setForm({
        ...EMPTY_FORM,
        ...initial,
        dateOfBirth: initial.dateOfBirth ? initial.dateOfBirth.substring(0, 10) : '',
        joiningDate: initial.joiningDate ? initial.joiningDate.substring(0, 10) : '',
        managerId: initial.managerId?._id || initial.managerId || '',
        floorHeadId: initial.floorHeadId?._id || initial.floorHeadId || '',
        teamLeadId: initial.teamLeadId?._id || initial.teamLeadId || '',
        shiftId: initial.shiftId?._id || initial.shiftId || '',
        workMode: initial.workMode || 'office',
        managedDepartments: initial.managedDepartments || [],
        salaryPaymentMethod: initial.salaryPaymentMethod || '',
        salaryAccountNumber: initial.salaryAccountNumber || '',
        salaryAccountTitle: initial.salaryAccountTitle || '',
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

  async function handleCreateDepartment() {
    const name = newDepartment.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setDepartmentError('Enter at least 2 characters.');
      return;
    }
    if (!isEdit && HIDDEN_CREATE_DEPARTMENTS.has(name.toLowerCase())) {
      setDepartmentError('This department is not available for employee creation.');
      return;
    }
    try {
      const result = await createDepartment({ name }).unwrap();
      const savedName = result.data.name;
      set('department', savedName);
      setNewDepartment('');
      setDepartmentError('');
      setDepartmentCreatorOpen(false);
      toast.success(`${savedName} department added.`);
    } catch (error) {
      setDepartmentError(error?.data?.error?.message || 'Unable to add department.');
    }
  }

  function handleCnicChange(event) {
    let value = event.target.value;
    // When backspace removes an auto-inserted dash, remove the preceding
    // digit too; otherwise formatting would immediately put the dash back.
    if (
      event.nativeEvent?.inputType === 'deleteContentBackward'
      && form.cnic.endsWith('-')
      && !value.endsWith('-')
    ) {
      value = value.replace(/\D/g, '').slice(0, -1);
    }
    set('cnic', formatCnic(value));
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
    const validationErrors = {};
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const cnic = form.cnic.trim();

    if (!fullName) validationErrors.fullName = 'Full name is required';
    else if (fullName.length < 2) validationErrors.fullName = 'Full name must contain at least 2 characters';

    if (!cnic) validationErrors.cnic = 'CNIC is required';
    else if (!/^\d{5}-\d{7}-\d$/.test(cnic)) validationErrors.cnic = 'Use format XXXXX-XXXXXXX-X';

    if (!email) validationErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationErrors.email = 'Enter a valid email address';

    if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date()) {
      validationErrors.dateOfBirth = 'Date of birth cannot be in the future';
    }
    if (form.contactNumber && !/^[+\d][\d\s()-]{6,19}$/.test(form.contactNumber.trim())) {
      validationErrors.contactNumber = 'Enter a valid contact number';
    }
    if (!form.joiningDate) validationErrors.joiningDate = 'Joining date is required';
    if (!form.department.trim()) validationErrors.department = 'Department is required';
    if (form.role === 'manager' && !form.managedDepartments.length && !form.department.trim()) {
      validationErrors.managedDepartments = 'Select at least one managed department';
    }
    if (!form.role || !allowedRoles.includes(form.role)) validationErrors.role = 'Select an allowed employee role';
    if (form.role === 'employee' && availableTeamLeads.length > 0 && !form.teamLeadId) {
      validationErrors.teamLeadId = 'Select the Team Lead this employee will report to';
    }
    if (!form.shiftId) validationErrors.shiftId = 'Shift assignment is required';
    if (form.currentSalary !== '' && (!Number.isFinite(Number(form.currentSalary)) || Number(form.currentSalary) < 0)) {
      validationErrors.currentSalary = 'Salary must be zero or a positive number';
    }
    const hasPaymentDetail = Boolean(
      form.salaryPaymentMethod
      || String(form.salaryAccountNumber || '').trim()
      || String(form.salaryAccountTitle || '').trim(),
    );
    if (hasPaymentDetail) {
      if (!form.salaryPaymentMethod) validationErrors.salaryPaymentMethod = 'Select a bank or wallet';
      if (!String(form.salaryAccountNumber || '').trim()) validationErrors.salaryAccountNumber = 'Account number is required';
      else if (!/^[A-Za-z0-9+\-\s]{5,50}$/.test(String(form.salaryAccountNumber).trim())) {
        validationErrors.salaryAccountNumber = 'Enter a valid account, IBAN, or wallet number';
      }
      if (!String(form.salaryAccountTitle || '').trim()) validationErrors.salaryAccountTitle = 'Account title is required';
    }
    if (!isEdit) {
      if (!form.password) validationErrors.password = 'Initial password is required';
      else if (form.password.length < 8) validationErrors.password = 'Password must contain at least 8 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
        validationErrors.password = 'Include uppercase, lowercase and a number';
      if (!form.confirmPassword) validationErrors.confirmPassword = 'Please confirm the password';
      else if (form.password !== form.confirmPassword) validationErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(validationErrors);
    return validationErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validate();
    const invalidFields = Object.keys(validationErrors);
    if (invalidFields.length > 0) {
      for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
        if (fields.some((field) => validationErrors[field])) { setActiveTab(tab); break; }
      }
      const labels = invalidFields.map((field) => FIELD_LABELS[field] || field);
      const visibleLabels = labels.slice(0, 5).join(', ');
      const remaining = labels.length > 5 ? ` and ${labels.length - 5} more` : '';
      toast.error(`Please complete or correct: ${visibleLabels}${remaining}`);
      return;
    }
    const payload = { ...form };
    delete payload.confirmPassword;
    delete payload.employeeCode;
    delete payload.employeeCardNumber;
    if (isEdit) delete payload.password;
    // Optional date/enum fields must be omitted when blank. Sending an empty
    // string makes strict API validators treat them as invalid supplied data.
    ['dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup'].forEach((field) => {
      if (payload[field] === '') delete payload[field];
    });
    // Optional MongoDB references must be null (not an empty string) when the
    // user chooses "No Manager" or "No Team Lead".
    payload.managerId = payload.managerId || null;
    payload.floorHeadId = payload.floorHeadId || null;
    payload.teamLeadId = payload.teamLeadId || null;
    payload.shiftId = payload.shiftId || null;
    payload.managedDepartments = form.role === 'manager'
      ? [...new Set([form.department, ...form.managedDepartments].filter(Boolean))]
      : [];
    const saved = await onSubmit(payload);
    if (saved !== false) clearDraft();
  }

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);

  function goNext() {
    if (tabIndex < TABS.length - 1) setActiveTab(TABS[tabIndex + 1].id);
  }
  function goPrev() {
    if (tabIndex > 0) setActiveTab(TABS[tabIndex - 1].id);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-border overflow-x-auto shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasError = TAB_FIELDS[tab.id].some((field) => errors[field]);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
                ${hasError ? 'text-destructive' : ''}
                ${isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {hasError && <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-label="Contains errors" />}
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
                  label="CNIC" required
                  placeholder="11111-1111111-1"
                  value={form.cnic}
                  onChange={handleCnicChange}
                  inputMode="numeric"
                  maxLength={15}
                  autoComplete="off"
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
                    <option key={b} value={b}>{b === 'Unknown' ? 'Not Known' : b}</option>
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
                  label="Joining Date" required type="date"
                  value={form.joiningDate}
                  onChange={(e) => set('joiningDate', e.target.value)}
                  error={errors.joiningDate}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">
                      Department<span className="ml-0.5 text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDepartmentCreatorOpen((open) => !open);
                        setDepartmentError('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      aria-label="Add department"
                      title="Add department"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  <Select
                    required
                    value={form.department}
                    onChange={(e) => set('department', e.target.value.toLowerCase())}
                    error={errors.department}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </Select>
                  <AnimatePresence initial={false}>
                    {departmentCreatorOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={newDepartment}
                              onChange={(event) => {
                                setNewDepartment(event.target.value);
                                setDepartmentError('');
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  handleCreateDepartment();
                                }
                              }}
                              maxLength={100}
                              placeholder="Department name"
                              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            <Button
                              type="button"
                              size="sm"
                              loading={isCreatingDepartment}
                              onClick={handleCreateDepartment}
                            >
                              Save
                            </Button>
                          </div>
                          {departmentError && <p className="mt-1.5 text-xs text-destructive">{departmentError}</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {form.role === 'manager' && (
                  <div className="col-span-1 sm:col-span-2">
                    <Select
                      label="Managed Departments"
                      multiple
                      size={Math.min(Math.max(departments.length, 3), 6)}
                      value={form.managedDepartments}
                      onChange={(event) => set(
                        'managedDepartments',
                        Array.from(event.target.selectedOptions, (option) => option.value),
                      )}
                      error={errors.managedDepartments}
                      className="min-h-28"
                    >
                      {departments.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select all departments this manager controls. The primary department is included automatically.
                    </p>
                  </div>
                )}
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
                  error={errors.role}
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Assigned Shift" required
                  value={form.shiftId}
                  onChange={(e) => set('shiftId', e.target.value)}
                  error={errors.shiftId}
                  disabled={shiftsLoading || shiftsError || shifts.length === 0}
                >
                  <option value="">
                    {shiftsLoading ? 'Loading shifts...' : shifts.length ? 'Select a shift' : 'No active shifts available'}
                  </option>
                  {shifts.map((shift) => (
                    <option key={shift._id} value={shift._id}>
                      {shift.name} ({shift.shiftType === 'flexible' ? `Flexible ${(shift.requiredMinutes || 480) / 60} hours` : `${shift.startTime} - ${shift.endTime}`})
                    </option>
                  ))}
                </Select>
                {shiftsError && (
                  <button type="button" onClick={refetchShifts}
                    className="text-left text-xs font-medium text-destructive hover:underline">
                    Unable to load shifts. Click to retry.
                  </button>
                )}
                {!shiftsLoading && !shiftsError && shifts.length === 0 && (
                  <p className="text-xs text-destructive">
                    Create an active 8-hour shift in Settings → Shifts before adding an employee.
                  </p>
                )}
                <Input
                  label="Current Salary (PKR)"
                  placeholder="50000"
                  type="number"
                  sensitive
                  value={form.currentSalary}
                  onChange={(e) => set('currentSalary', e.target.value)}
                  error={errors.currentSalary}
                />
                <Select
                  label="Salary Bank / Wallet"
                  value={form.salaryPaymentMethod}
                  onChange={(e) => set('salaryPaymentMethod', e.target.value)}
                  error={errors.salaryPaymentMethod}
                >
                  <option value="">Select payment method</option>
                  {SALARY_PAYMENT_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
                <Select
                  label="Work Mode"
                  value={form.workMode}
                  onChange={(e) => set('workMode', e.target.value)}
                >
                  <option value="office">Office</option>
                  <option value="wfh">Work From Home</option>
                </Select>
                <Input
                  label="Account / IBAN / Wallet Number"
                  placeholder="PK00BANK0000000000000000"
                  value={form.salaryAccountNumber}
                  onChange={(e) => set('salaryAccountNumber', e.target.value)}
                  error={errors.salaryAccountNumber}
                  autoComplete="off"
                />
                <Input
                  label="Account Title"
                  placeholder="Account holder name"
                  value={form.salaryAccountTitle}
                  onChange={(e) => set('salaryAccountTitle', e.target.value)}
                  error={errors.salaryAccountTitle}
                  autoComplete="off"
                />
                {['employee', 'team_lead', 'floor_head'].includes(form.role) && !departmentManager && (
                  <Select
                    label="Reporting Manager"
                    value={form.managerId}
                    disabled={!form.department || availableManagers.length === 0}
                    onChange={(e) => {
                      const managerId = e.target.value;
                      set('managerId', managerId);
                      const selectedLead = teamLeads.find((lead) => lead._id === form.teamLeadId);
                      if (selectedLead && managerId && String(selectedLead.managerId?._id || selectedLead.managerId || '') !== managerId) set('teamLeadId', '');
                    }}
                  >
                    <option value="">
                      {!form.department
                        ? 'Select department first'
                        : availableManagers.length
                          ? 'Select Reporting Manager'
                          : 'No active Manager in this department'}
                    </option>
                    {availableManagers.map((m) => (
                      <option key={m._id} value={m._id}>{m.fullName} ({m.designation})</option>
                    ))}
                  </Select>
                )}
                {['employee', 'team_lead'].includes(form.role) && (
                  <Select
                    label="Floor Head"
                    value={form.floorHeadId}
                    disabled={!form.department || availableFloorHeads.length === 0}
                    onChange={(e) => set('floorHeadId', e.target.value)}
                  >
                    <option value="">
                      {!form.department
                        ? 'Select department first'
                        : availableFloorHeads.length
                          ? 'No Floor Head / Report directly to Manager'
                          : 'No Floor Head in this department'}
                    </option>
                    {availableFloorHeads.map((head) => (
                      <option key={head._id} value={head._id}>{head.fullName} ({head.designation || 'Floor Head'})</option>
                    ))}
                  </Select>
                )}
                {form.role === 'employee' && (
                  <Select
                    label="Team Lead"
                    required={availableTeamLeads.length > 0}
                    value={form.teamLeadId}
                    disabled={!form.department || availableTeamLeads.length === 0}
                    onChange={(e) => set('teamLeadId', e.target.value)}
                    error={errors.teamLeadId}
                  >
                    <option value="">
                      {!form.department
                        ? 'Select department first'
                        : availableTeamLeads.length
                          ? 'Select Team Lead'
                          : 'No active Team Lead in this department'}
                    </option>
                    {availableTeamLeads.map((t) => (
                      <option key={t._id} value={t._id}>{t.fullName} ({t.designation || 'Team Lead'})</option>
                    ))}
                  </Select>
                )}
                <Input
                  label="Biometric Device User ID"
                  placeholder="Exact user ID shown on ZKTeco device"
                  value={form.biometricDeviceUserId || ''}
                  onChange={(e) => set('biometricDeviceUserId', e.target.value.trim())}
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
