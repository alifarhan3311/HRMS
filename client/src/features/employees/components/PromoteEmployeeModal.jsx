/**
 * features/employees/components/PromoteEmployeeModal.jsx
 * Modal for promoting/transferring an employee — updates designation, department, role, salary.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Avatar } from '../../../components/ui/Avatar';
import {
  useCreateEmployeeDepartmentMutation,
  useDeleteEmployeeDepartmentMutation,
  useGetEmployeeDepartmentsQuery,
} from '../api/employees.api';
import { toast } from '../../../utils/toast';

const DEFAULT_ROLES = ['employee', 'team_lead', 'floor_head', 'manager'];
const HIDDEN_DEPARTMENTS = new Set([
  'hr', 'human resource', 'human resources', 'human resources department',
]);

export default function PromoteEmployeeModal({
  employee, isOpen, onClose, onSubmit, isLoading, allowedRoles = DEFAULT_ROLES,
}) {
  const { data: departmentsData } = useGetEmployeeDepartmentsQuery(undefined, { skip: !isOpen });
  const [createDepartment, { isLoading: isCreatingDepartment }] = useCreateEmployeeDepartmentMutation();
  const [deleteDepartment, { isLoading: isDeletingDepartment }] = useDeleteEmployeeDepartmentMutation();
  const departments = [...new Set([
    ...(departmentsData?.data || []),
    ...(employee?.department ? [employee.department] : []),
  ].map((department) => String(department || '').trim()).filter(Boolean))]
    .filter((department) => !HIDDEN_DEPARTMENTS.has(
      department.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
    ))
    .sort((left, right) => left.localeCompare(right));
  const [form, setForm] = useState({
    designation: '',
    department: employee?.department || '',
    role: employee?.role || 'employee',
    currentSalary: '',
    incrementAmount: '',
    effectiveDate: new Date().toISOString().substring(0, 10),
    remarks: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!employee || !isOpen) return;
    setForm({
      designation: '',
      department: employee.department || '',
      role: employee.role || 'employee',
      currentSalary: '',
      incrementAmount: '',
      effectiveDate: new Date().toISOString().substring(0, 10),
      remarks: '',
    });
    setErrors({});
  }, [employee, isOpen]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.designation.trim()) e.designation = 'New designation is required';
    if (!form.effectiveDate) e.effectiveDate = 'Effective date is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      incrementAmount: form.incrementAmount ? Number(form.incrementAmount) : undefined,
    });
  }

  async function handleAddDepartment() {
    const name = window.prompt('Enter new department name:')?.trim();
    if (!name) return;
    try {
      const response = await createDepartment({ name }).unwrap();
      const createdName = response?.data?.name || name.toLowerCase();
      set('department', createdName);
      toast.success('Department added successfully');
    } catch (error) {
      toast.error(error?.data?.error?.message || error?.data?.message || 'Could not add department');
    }
  }

  async function handleDeleteDepartment() {
    if (!form.department) return toast.error('Select a department first');
    if (!window.confirm(`Delete "${form.department}" department?`)) return;
    try {
      await deleteDepartment(form.department).unwrap();
      set('department', '');
      toast.success('Department deleted successfully');
    } catch (error) {
      toast.error(error?.data?.error?.message || error?.data?.message || 'Department could not be deleted');
    }
  }

  if (!employee) return null;
  const oldSalary = Number(employee.currentSalary || 0);
  const newSalary = Number(form.currentSalary || 0);
  const salaryDifference = newSalary > 0 ? newSalary - oldSalary : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Promote / Transfer Employee" size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5">
          {/* Employee Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <Avatar name={employee.fullName} size="md" />
            <div>
              <p className="font-medium text-sm">{employee.fullName}</p>
              <p className="text-xs text-muted-foreground">
                Currently: {employee.designation || '—'} · {employee.department || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-2">
              <Input
                label="New Designation" required
                placeholder="Senior Software Engineer"
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
                error={errors.designation}
              />
            </div>
            <div>
              <Select
                label="New Department"
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </option>
                ))}
              </Select>
              <div className="mt-2 flex items-center gap-2">
                <Button type="button" variant="outline" size="icon"
                  className="h-8 w-8 rounded-lg text-primary hover:border-primary/40 hover:bg-primary/10"
                  aria-label="Add department" title="Add department"
                  disabled={isCreatingDepartment} onClick={handleAddDepartment}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon"
                  className="h-8 w-8 rounded-lg text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  aria-label="Delete selected department" title="Delete selected department"
                  disabled={!form.department || isDeletingDepartment} onClick={handleDeleteDepartment}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Select
              label="New Role"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
            <Input
              label="Current / Old Salary (PKR)"
              value={oldSalary ? oldSalary.toLocaleString('en-PK') : 'Not configured'}
              readOnly
              disabled
            />
            <Input
              label="New Salary (PKR)"
              type="number"
              placeholder="75000"
              value={form.currentSalary}
              onChange={(e) => set('currentSalary', e.target.value)}
            />
            <Input
              label="Increment Amount (PKR)"
              type="number"
              placeholder="10000"
              value={form.incrementAmount}
              onChange={(e) => set('incrementAmount', e.target.value)}
            />
            {newSalary > 0 && (
              <div className={`rounded-xl border px-3 py-2 text-sm ${
                salaryDifference >= 0
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-700'
              }`}>
                Salary difference: <span className="font-semibold">
                  {salaryDifference >= 0 ? '+' : '-'} PKR {Math.abs(salaryDifference).toLocaleString('en-PK')}
                </span>
              </div>
            )}
            <Input
              label="Effective Date" required type="date"
              value={form.effectiveDate}
              onChange={(e) => set('effectiveDate', e.target.value)}
              error={errors.effectiveDate}
            />
          </div>
          <Textarea
            label="Remarks"
            placeholder="Promoted due to outstanding performance..."
            value={form.remarks}
            onChange={(e) => set('remarks', e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            {isLoading ? 'Processing...' : 'Confirm Promotion'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
