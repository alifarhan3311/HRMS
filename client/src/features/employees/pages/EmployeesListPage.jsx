/**
 * features/employees/pages/EmployeesListPage.jsx
 * Full-featured enterprise employee management page.
 * Features: search, filter by dept/status/role, sortable table, pagination,
 * create/edit modal, detail panel, promote modal, status change, delete confirm.
 */
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, Filter, ChevronLeft, ChevronRight,
  MoreHorizontal, Edit, Trash2, UserX, UserCheck, TrendingUp,
  Eye, Download, RefreshCw, Building2, Briefcase,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { toast } from '../../../utils/toast';

import {
  useListEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useChangeEmployeeStatusMutation,
  usePromoteEmployeeMutation,
  useGetEmployeeStatsQuery,
} from '../api/employees.api';

import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge, RoleBadge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import StatCard from '../../../components/ui/StatCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import EmployeeForm from '../components/EmployeeForm';
import EmployeeDetailPanel from '../components/EmployeeDetailPanel';
import PromoteEmployeeModal from '../components/PromoteEmployeeModal';

const STATUSES = ['active', 'inactive', 'on_leave', 'resigned'];
const ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin', 'super_admin'];

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-xl">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function EmployeesListPage() {
  const { user } = useSelector((s) => s.auth);
  const canManage = ['admin', 'hr', 'super_admin'].includes(user?.role);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ status: '', department: '', role: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');
  const LIMIT = 15;

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [promoteEmployee, setPromoteEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null); // { employee, newStatus }
  const [actionMenuId, setActionMenuId] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);

  // Queries & mutations
  const queryParams = {
    page,
    limit: LIMIT,
    sort,
    ...(search && { search }),
    ...(filters.status && { status: filters.status }),
    ...(filters.department && { department: filters.department }),
    ...(filters.role && { role: filters.role }),
  };
  const { data, isLoading, isFetching, refetch } = useListEmployeesQuery(queryParams);
  const { data: statsData } = useGetEmployeeStatsQuery();

  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [deleteEmployee, { isLoading: isDeleting }] = useDeleteEmployeeMutation();
  const [changeStatus, { isLoading: isChangingStatus }] = useChangeEmployeeStatusMutation();
  const [promoteEmp, { isLoading: isPromoting }] = usePromoteEmployeeMutation();

  const employees = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const stats = statsData?.data;

  // Search with debounce on Enter / blur
  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function applyFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ status: '', department: '', role: '' });
    setSearch('');
    setSearchInput('');
    setPage(1);
  }

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  async function handleCreate(payload) {
    try {
      await createEmployee(payload).unwrap();
      toast.success('Employee created successfully');
      setFormOpen(false);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Failed to create employee');
    }
  }

  async function handleUpdate(payload) {
    try {
      await updateEmployee({ id: editEmployee._id, ...payload }).unwrap();
      toast.success('Employee updated successfully');
      setEditEmployee(null);
      setFormOpen(false);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Failed to update employee');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget._id).unwrap();
      toast.success('Employee permanently deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Failed to delete employee');
    }
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    try {
      await changeStatus({ id: statusTarget.employee._id, status: statusTarget.newStatus }).unwrap();
      toast.success(`Employee marked as ${statusTarget.newStatus}`);
      setStatusTarget(null);
      if (detailEmployee?._id === statusTarget.employee._id) {
        setDetailEmployee(null);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handlePromote(payload) {
    try {
      await promoteEmp({ id: promoteEmployee._id, ...payload }).unwrap();
      toast.success('Employee promoted successfully');
      setPromoteEmployee(null);
    } catch (err) {
      toast.error('Failed to promote employee');
    }
  }

  function openEdit(emp) {
    setEditEmployee(emp);
    setFormOpen(true);
    setActionMenuId(null);
  }

  function openDetail(emp) {
    setDetailEmployee(emp);
    setActionMenuId(null);
  }

  const activeFiltersCount = [filters.status, filters.department, filters.role, search].filter(Boolean).length;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your workforce — {total} total {total === 1 ? 'employee' : 'employees'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary" size="sm"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
          {canManage && (
            <Button
              variant="primary" size="sm"
              className="gap-1.5"
              onClick={() => { setEditEmployee(null); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={isLoading ? '—' : (stats?.total ?? total)}
          icon={Users}
        />
        <StatCard
          title="Active"
          value={isLoading ? '—' : (stats?.active ?? '—')}
          icon={UserCheck}
          trend={{ label: 'Currently working', positive: true }}
        />
        <StatCard
          title="On Leave"
          value={isLoading ? '—' : (stats?.onLeave ?? '—')}
          icon={Briefcase}
        />
        <StatCard
          title="Inactive / Resigned"
          value={isLoading ? '—' : ((stats?.inactive ?? 0) + (stats?.resigned ?? 0))}
          icon={UserX}
        />
      </div>

      {/* Toolbar */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, email, code..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </form>

          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            className="gap-1.5 relative"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}

          {/* Sort */}
          <select
            className="ml-auto rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            <option value="-createdAt">Newest First</option>
            <option value="createdAt">Oldest First</option>
            <option value="fullName">Name A–Z</option>
            <option value="-fullName">Name Z–A</option>
            <option value="joiningDate">Joining Date ↑</option>
            <option value="-joiningDate">Joining Date ↓</option>
          </select>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-3 border-t border-border grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    value={filters.status}
                    onChange={(e) => applyFilter('status', e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    value={filters.role}
                    onChange={(e) => applyFilter('role', e.target.value)}
                  >
                    <option value="">All Roles</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
                  <input
                    type="text"
                    placeholder="Engineering..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={filters.department}
                    onChange={(e) => applyFilter('department', e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4"><TableSkeleton /></div>
        ) : employees.length === 0 ? (
          <EmptyState hasFilters={activeFiltersCount > 0} onClear={clearFilters} onAdd={() => setFormOpen(true)} canManage={canManage} />
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {employees.map((emp, i) => (
                <motion.div
                  key={emp._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.6), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ backgroundColor: 'hsl(var(--accent) / 0.4)', x: 2 }}
                  className="grid grid-cols-1 md:grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 transition-colors cursor-pointer group"
                  onClick={() => openDetail(emp)}
                >
                  {/* Employee */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={emp.fullName} src={emp.profilePicture} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    <span className="ml-1 text-xs text-muted-foreground/60 hidden xl:block">{emp.employeeCode}</span>
                  </div>

                  {/* Department / Designation */}
                  <div className="flex items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{emp.department || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.designation || '—'}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    <StatusBadge status={emp.status} />
                  </div>

                  {/* Role */}
                  <div className="flex items-center">
                    <RoleBadge role={emp.role} />
                  </div>

                  {/* Joined */}
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground">{formatDate(emp.joiningDate)}</span>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          if (actionMenuId === emp._id) {
                            setActionMenuId(null);
                            setActionMenuAnchor(null);
                            return;
                          }
                          setActionMenuAnchor(event.currentTarget.getBoundingClientRect());
                          setActionMenuId(emp._id);
                        }}
                        className={`rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:opacity-100 ${actionMenuId === emp._id ? 'bg-accent text-foreground opacity-100' : 'opacity-0'}`}
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {actionMenuId === emp._id && (
                          <ActionMenu
                            employee={emp}
                            canManage={canManage}
                            canDelete={user?.role === 'super_admin'}
                            isSelf={String(user?.id || user?._id) === String(emp._id)}
                            anchorRect={actionMenuAnchor}
                            onView={() => openDetail(emp)}
                            onEdit={() => openEdit(emp)}
                            onPromote={() => { setPromoteEmployee(emp); setActionMenuId(null); }}
                            onActivate={() => { setStatusTarget({ employee: emp, newStatus: 'active' }); setActionMenuId(null); }}
                            onDeactivate={() => { setStatusTarget({ employee: emp, newStatus: 'inactive' }); setActionMenuId(null); }}
                            onDelete={() => { setDeleteTarget(emp); setActionMenuId(null); }}
                            onClose={() => { setActionMenuId(null); setActionMenuAnchor(null); }}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`h-7 w-7 rounded-md text-xs font-medium transition-colors
                      ${page === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-muted-foreground text-xs px-1">...</span>}
              <Button
                variant="secondary" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditEmployee(null); }}
        title={editEmployee ? 'Edit Employee' : 'Add New Employee'}
        size="xl"
      >
        <EmployeeForm
          initial={editEmployee}
          onSubmit={editEmployee ? handleUpdate : handleCreate}
          onClose={() => { setFormOpen(false); setEditEmployee(null); }}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Detail Panel */}
      <EmployeeDetailPanel
        employee={detailEmployee}
        isOpen={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        onEdit={(emp) => { openEdit(emp); setDetailEmployee(null); }}
        onStatusChange={(emp, status) => { setStatusTarget({ employee: emp, newStatus: status }); setDetailEmployee(null); }}
        onPromote={(emp) => { setPromoteEmployee(emp); setDetailEmployee(null); }}
        canManage={canManage}
      />

      {/* Promote Modal */}
      <PromoteEmployeeModal
        employee={promoteEmployee}
        isOpen={!!promoteEmployee}
        onClose={() => setPromoteEmployee(null)}
        onSubmit={handlePromote}
        isLoading={isPromoting}
      />

      {/* Status Change Confirm */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        onCancel={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        isLoading={isChangingStatus}
        title={statusTarget?.newStatus === 'inactive' ? 'Deactivate Employee?' : 'Activate Employee?'}
        message={
          statusTarget?.newStatus === 'inactive'
            ? `${statusTarget?.employee?.fullName} will no longer be able to log in.`
            : `${statusTarget?.employee?.fullName}'s account will be reactivated.`
        }
        confirmLabel={statusTarget?.newStatus === 'inactive' ? 'Deactivate' : 'Activate'}
        variant={statusTarget?.newStatus === 'inactive' ? 'danger' : 'primary'}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Permanently Delete Employee?"
        message={`This will permanently delete ${deleteTarget?.fullName}'s account. This action cannot be undone. Use Deactivate if their records should be preserved.`}
        confirmLabel="Delete Permanently"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionMenu({ employee, canManage, canDelete, isSelf, anchorRect, onView, onEdit, onPromote, onActivate, onDeactivate, onDelete, onClose }) {
  if (!anchorRect) return null;

  const estimatedHeight = canManage && !isSelf ? 238 : canManage ? 112 : 44;
  const opensUpward = anchorRect.bottom + estimatedHeight + 12 > window.innerHeight;
  const menuStyle = {
    top: opensUpward
      ? Math.max(8, anchorRect.top - estimatedHeight - 8)
      : anchorRect.bottom + 8,
    right: Math.max(8, window.innerWidth - anchorRect.right),
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -4 }}
        transition={{ duration: 0.1 }}
        style={menuStyle}
        className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-border bg-card py-1 text-card-foreground shadow-2xl"
      >
        <MenuItem icon={Eye} label="View Profile" onClick={onView} />
        {canManage && (
          <>
            <MenuItem icon={Edit} label="Edit" onClick={onEdit} />
            <MenuItem icon={TrendingUp} label="Promote / Transfer" onClick={onPromote} />
            {!isSelf && (
              <>
                <div className="my-1 h-px bg-border" />
                {employee.status === 'active' ? (
                  <MenuItem icon={UserX} label="Deactivate" onClick={onDeactivate} className="text-amber-600" />
                ) : (
                  <MenuItem icon={UserCheck} label="Activate" onClick={onActivate} className="text-emerald-600" />
                )}
                {canDelete && (
                  <MenuItem icon={Trash2} label="Delete Permanently" onClick={onDelete} className="text-destructive" />
                )}
              </>
            )}
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
}

function MenuItem({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function EmptyState({ hasFilters, onClear, onAdd, canManage }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">
        {hasFilters ? 'No employees match your filters' : 'No employees yet'}
      </h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-xs">
        {hasFilters
          ? 'Try adjusting or clearing your filters to see more results.'
          : 'Add your first employee to get started.'}
      </p>
      <div className="flex gap-2 mt-4">
        {hasFilters && (
          <Button variant="secondary" size="sm" onClick={onClear}>Clear Filters</Button>
        )}
        {canManage && (
          <Button variant="primary" size="sm" onClick={onAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        )}
      </div>
    </div>
  );
}

// Missing X import — add it
function X({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
