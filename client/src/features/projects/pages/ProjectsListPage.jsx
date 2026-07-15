/**
 * features/projects/pages/ProjectsListPage.jsx
 * Full project management — create, view, assign teams, track status.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  FolderKanban, Plus, RefreshCw, Clock, Users,
  CheckCircle2, Circle, PauseCircle, XCircle, Briefcase,
} from 'lucide-react';
import { useListProjectsQuery, useCreateProjectMutation, useUpdateProjectMutation } from '../api/projects.api';
import { toast } from '../../../utils/toast';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import StatCard from '../../../components/ui/StatCard';
import { Skeleton } from '../../../components/ui/Skeleton';

const STATUS_STYLES = {
  planning:  { label: 'Planning',   variant: 'blue',   Icon: Circle },
  active:    { label: 'Active',     variant: 'green',  Icon: CheckCircle2 },
  on_hold:   { label: 'On Hold',    variant: 'yellow', Icon: PauseCircle },
  completed: { label: 'Completed',  variant: 'purple', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled',  variant: 'red',    Icon: XCircle },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProjectForm({ initial, onSubmit, onClose, isLoading }) {
  const [form, setForm] = useState({
    name:         initial?.name         || '',
    clientName:   initial?.clientName   || '',
    description:  initial?.description  || '',
    status:       initial?.status       || 'planning',
    startDate:    initial?.startDate    ? initial.startDate.substring(0, 10) : '',
    endDate:      initial?.endDate      ? initial.endDate.substring(0, 10)   : '',
    billableHours:initial?.billableHours|| '',
    incentivePool:initial?.incentivePool|| '',
  });
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    onSubmit(form);
  }
  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4">
        <Input label="Project Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. E-Commerce Platform" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Client Name" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Client / Company" />
          <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Input label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          <Input label="End Date"   type="date" value={form.endDate}   onChange={e => set('endDate', e.target.value)} />
          <Input label="Billable Hours" type="number" value={form.billableHours} onChange={e => set('billableHours', e.target.value)} placeholder="0" />
          <Input label="Incentive Pool (PKR)" type="number" value={form.incentivePool} onChange={e => set('incentivePool', e.target.value)} placeholder="0" />
        </div>
        <Textarea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Project overview..." />
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <FolderKanban className="h-4 w-4" /> {isLoading ? 'Saving...' : initial ? 'Save Changes' : 'Create Project'}
        </Button>
      </ModalFooter>
    </form>
  );
}

export default function ProjectsListPage() {
  const { user } = useSelector(s => s.auth);
  const canManage = ['admin', 'hr', 'super_admin', 'manager'].includes(user?.role);

  const [formOpen, setFormOpen]   = useState(false);
  const [editProj, setEditProj]   = useState(null);
  const [page, setPage]           = useState(1);

  const { data, isLoading, isFetching, refetch } = useListProjectsQuery({ page, limit: 12 });
  const [createProject, { isLoading: creating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: updating }] = useUpdateProjectMutation();

  const projects   = data?.items || [];
  const total      = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_STYLES).map(s => [s, projects.filter(p => p.status === s).length])
  );

  async function handleSubmit(payload) {
    try {
      if (editProj) { await updateProject({ id: editProj._id, ...payload }).unwrap(); toast.success('Project updated'); }
      else          { await createProject(payload).unwrap(); toast.success('Project created'); }
      setFormOpen(false); setEditProj(null);
    } catch (err) { toast.error(err?.data?.error?.message || 'Operation failed'); }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { setEditProj(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      </motion.div>

      {/* Status stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active"    value={statusCounts.active    || 0} icon={CheckCircle2} trend={{ label: 'In progress', positive: true }} />
        <StatCard title="Planning"  value={statusCounts.planning  || 0} icon={Circle} />
        <StatCard title="On Hold"   value={statusCounts.on_hold   || 0} icon={PauseCircle} />
        <StatCard title="Completed" value={statusCounts.completed || 0} icon={Briefcase} />
      </div>

      {/* Project cards grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card py-20 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No projects yet</p>
          {canManage && <Button variant="primary" size="sm" className="mt-4 gap-1.5" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Create First Project</Button>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj, i) => {
            const st = STATUS_STYLES[proj.status] || STATUS_STYLES.active;
            const Icon = st.Icon;
            return (
              <motion.div key={proj._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card p-5 hover:shadow-glow hover:-translate-y-0.5 transition-all cursor-pointer group"
                onClick={() => canManage && (setEditProj(proj), setFormOpen(true))}>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant={st.variant} className="flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {st.label}
                  </Badge>
                </div>
                <h3 className="font-semibold truncate">{proj.name}</h3>
                {proj.clientName && <p className="text-xs text-muted-foreground mt-0.5">{proj.clientName}</p>}
                {proj.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{proj.description}</p>}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  {proj.teamMembers?.length > 0 && (
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{proj.teamMembers.length} members</span>
                  )}
                  {proj.billableHours > 0 && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{proj.billableHours}h</span>
                  )}
                  {proj.endDate && (
                    <span className="ml-auto">Due: {fmtDate(proj.endDate)}</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>Previous</Button>
          <span className="px-3 py-2 text-sm text-muted-foreground">{page}/{totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Next</Button>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditProj(null); }}
        title={editProj ? 'Edit Project' : 'New Project'} size="md">
        <ProjectForm initial={editProj} onSubmit={handleSubmit} onClose={() => { setFormOpen(false); setEditProj(null); }}
          isLoading={creating || updating} />
      </Modal>
    </div>
  );
}
