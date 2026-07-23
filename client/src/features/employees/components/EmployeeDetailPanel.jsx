/**
 * features/employees/components/EmployeeDetailPanel.jsx
 * Side drawer showing full employee profile with all details, history, and quick actions.
 */
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, Phone, MapPin, Briefcase, Calendar, User, Heart,
  Droplets, GraduationCap, Banknote, TrendingUp, Clock, Shield,
  CreditCard, Award, Edit, UserX, UserCheck, ArrowUpRight, KeyRound,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge, RoleBadge, Badge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="mt-0.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
        {title}
      </h4>
      <div className="glass-card px-4 py-1">
        {children}
      </div>
    </div>
  );
}

export default function EmployeeDetailPanel({
  employee,
  isOpen,
  onClose,
  onEdit,
  onStatusChange,
  onPromote,
  onResetPassword,
  canManage = false,
}) {
  if (!employee) return null;

  const tenure = employee.tenure;
  const tenureStr = tenure
    ? `${tenure.years}y ${tenure.months}m ${tenure.days}d`
    : '—';

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (v) => {
    if (!v) return '—';
    const num = Number(v);
    if (isNaN(num)) return v;
    return `PKR ${num.toLocaleString()}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-screen w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Employee Profile
              </p>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* Hero */}
              <div className="py-6 flex flex-col items-center text-center">
                <Avatar name={employee.fullName} src={employee.profilePicture} size="2xl" className="ring-4 ring-primary/20" />
                <h2 className="mt-4 text-xl font-bold">{employee.fullName}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {employee.designation || '—'} {employee.department ? `· ${employee.department}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                  <StatusBadge status={employee.status} />
                  <RoleBadge role={employee.role} />
                  <Badge variant="gray">{employee.employeeCode}</Badge>
                </div>
                {tenure && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Tenure: {tenureStr}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {canManage && (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary" size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onEdit(employee)}
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onPromote(employee)}
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Promote
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    className="gap-1.5"
                    onClick={() => onResetPassword(employee)}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset Password
                  </Button>
                  {employee.status === 'active' ? (
                    <Button
                      variant="secondary" size="sm"
                      className="flex-1 gap-1.5 text-amber-600 hover:text-amber-700"
                      onClick={() => onStatusChange(employee, 'inactive')}
                    >
                      <UserX className="h-3.5 w-3.5" /> Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary" size="sm"
                      className="flex-1 gap-1.5 text-emerald-600 hover:text-emerald-700"
                      onClick={() => onStatusChange(employee, 'active')}
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Activate
                    </Button>
                  )}
                </div>
              )}

              {/* Personal Info */}
              <Section title="Personal Information">
                <InfoRow icon={User} label="Father's Name" value={employee.fatherName} />
                <InfoRow icon={Shield} label="CNIC" value={employee.cnic} />
                <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                <InfoRow icon={User} label="Gender" value={employee.gender?.charAt(0).toUpperCase() + employee.gender?.slice(1)} />
                <InfoRow icon={Heart} label="Marital Status" value={employee.maritalStatus?.charAt(0).toUpperCase() + employee.maritalStatus?.slice(1)} />
                <InfoRow icon={Droplets} label="Blood Group" value={employee.bloodGroup} />
              </Section>

              {/* Contact */}
              <Section title="Contact Details">
                <InfoRow icon={Mail} label="Email" value={employee.email} />
                <InfoRow icon={Phone} label="Phone" value={employee.contactNumber} />
                <InfoRow icon={Phone} label="Emergency Contact" value={employee.emergencyContact} />
                <InfoRow icon={MapPin} label="Address" value={employee.address} />
              </Section>

              {/* Employment */}
              <Section title="Employment Details">
                <InfoRow icon={Calendar} label="Joining Date" value={formatDate(employee.joiningDate)} />
                <InfoRow icon={Briefcase} label="Department" value={employee.department} />
                <InfoRow icon={Briefcase} label="Designation" value={employee.designation} />
                <InfoRow icon={User} label="Manager" value={employee.managerId?.fullName} />
                <InfoRow icon={User} label="Team Lead" value={employee.teamLeadId?.fullName} />
                <InfoRow icon={Clock} label="Assigned Shift" value={employee.shiftId ? `${employee.shiftId.name} (${employee.shiftId.shiftType === 'flexible' ? 'Flexible 8 hours' : `${employee.shiftId.startTime} - ${employee.shiftId.endTime}`})` : 'General company timing'} />
                <InfoRow icon={CreditCard} label="Employee Card" value={employee.employeeCardNumber} />
                <InfoRow icon={Shield} label="Insurance Card" value={employee.insuranceCardNumber} />
              </Section>

              {/* Salary */}
              <Section title="Compensation">
                <InfoRow icon={Banknote} label="Current Salary" value={formatCurrency(employee.currentSalary)} />
                <InfoRow icon={TrendingUp} label="Last Increment" value={
                  employee.lastIncrementAmount
                    ? `${formatCurrency(employee.lastIncrementAmount)} on ${formatDate(employee.lastIncrementDate)}`
                    : undefined
                } />
              </Section>

              {/* Professional */}
              <Section title="Professional Details">
                <InfoRow icon={GraduationCap} label="Qualification" value={employee.qualification} />
                <InfoRow icon={Briefcase} label="Experience" value={employee.experience} />
              </Section>

              {/* Skills */}
              {employee.skills?.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Leave Balance */}
              {employee.leaveBalance && (
                <Section title="Leave Balance">
                  {Object.entries(employee.leaveBalance).map(([type, bal]) => (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm capitalize">{type} Leave</span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600 font-medium">{(bal.available - bal.used)} rem</span>
                        <span className="text-muted-foreground">{bal.used} used / {bal.available} total</span>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Promotion History */}
              {employee.promotionHistory?.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    Promotion History
                  </h4>
                  <div className="space-y-2">
                    {employee.promotionHistory.slice().reverse().map((p, i) => (
                      <div key={i} className="glass-card px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Award className="h-3.5 w-3.5 text-primary" />
                              {p.designation}
                            </p>
                            {p.department && (
                              <p className="text-xs text-muted-foreground mt-0.5">{p.department}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(p.effectiveDate)}</span>
                        </div>
                        {p.incrementAmount > 0 && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            +{formatCurrency(p.incrementAmount)} increment
                          </p>
                        )}
                        {p.remarks && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{p.remarks}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
