/**
 * features/employees/components/PromoteEmployeeModal.jsx
 * Modal for promoting/transferring an employee — updates designation, department, role, salary.
 */
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Avatar } from '../../../components/ui/Avatar';

const ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin'];

export default function PromoteEmployeeModal({ employee, isOpen, onClose, onSubmit, isLoading }) {
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

  if (!employee) return null;

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
            <Input
              label="New Department"
              placeholder="Engineering"
              value={form.department}
              onChange={(e) => set('department', e.target.value)}
            />
            <Select
              label="New Role"
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
