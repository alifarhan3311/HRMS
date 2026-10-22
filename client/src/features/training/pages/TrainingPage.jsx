import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BookOpen, GraduationCap, Plus, Pencil, Trash2, UsersRound, Sparkles, Coins } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { toast } from '../../../utils/toast';
import RuleContent from '../../rules/components/RuleContent';
import TrainingEditor from '../components/TrainingEditor';
import {
  useListTrainingCommissionsQuery,
  useGetMySalesCommissionPeriodsQuery,
  useCreateTrainingCategoryMutation,
  useDeleteTrainingCategoryMutation,
  useListTrainingCategoriesQuery,
  useUpdateTrainingCategoryMutation,
} from '../api/training.api';

export default function TrainingPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const user = useSelector(state => state.auth.user);
  const role = user?.role;
  const canManage = ['admin', 'hr', 'super_admin'].includes(role);
  const employeeDepartment = String(user?.department || '').toLowerCase().replace(/[^a-z]/g, '');
  const isCallCenterEmployee = ['employee', 'team_lead', 'floor_head', 'manager'].includes(role) && ['callcenter', 'callcentre'].includes(employeeDepartment);
  const canView = canManage || ['callcenter', 'callcentre'].includes(employeeDepartment);
  const { data, isLoading, isError, refetch } = useListTrainingCategoriesQuery(undefined, { skip: !canView, refetchOnMountOrArgChange: true });
  const { data: commissionData } = useListTrainingCommissionsQuery(undefined, { skip: !canView });
  const today = new Date();
  const { data: mySalesData, isLoading: mySalesLoading } = useGetMySalesCommissionPeriodsQuery({ month: today.getMonth() + 1, year: today.getFullYear() }, { skip: !isCallCenterEmployee });
  const [createCategory, { isLoading: creating }] = useCreateTrainingCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateTrainingCategoryMutation();
  const [deleteCategory, { isLoading: deleting }] = useDeleteTrainingCategoryMutation();
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const categories = data?.items || [];
  const activeCategory = useMemo(() => categories.find(category => category._id === categoryId), [categories, categoryId]);
  const commissionSlug = activeCategory?.slug === 'business-loans' ? 'loan-services' : activeCategory?.slug;
  const activeCommission = commissionData?.items?.find(item => item.slug === commissionSlug);

  useEffect(() => {
    if (!isLoading && categories.length && !categoryId) navigate(`/training/${categories[0]._id}`, { replace: true });
  }, [categories, categoryId, isLoading, navigate]);
  useEffect(() => {
    if (!isLoading && categoryId && categoryId !== 'commission' && categories.length && !activeCategory) navigate('/training', { replace: true });
    if (!isLoading && categoryId === 'commission') navigate('/commissions', { replace: true });
  }, [activeCategory, categories.length, categoryId, isLoading, navigate, role]);

  async function save(payload) {
    try {
      if (editor.category) {
        const updated = await updateCategory({ id: editor.category._id, ...payload }).unwrap();
        toast.success('Training tab updated');
        navigate(`/training/${updated.data._id}`, { replace: true });
      } else {
        const created = await createCategory(payload).unwrap();
        toast.success('Training tab added');
        navigate(`/training/${created.data._id}`);
      }
      setEditor(null);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save the training tab.');
      throw error;
    }
  }

  async function removeCategory() {
    try {
      await deleteCategory({ id: deleteTarget._id, revision: deleteTarget.revision }).unwrap();
      toast.success('Training tab and its details archived');
      setDeleteTarget(null);
      navigate('/training', { replace: true });
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to remove this training tab.');
    }
  }

  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
      <GraduationCap aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-52 w-52 rotate-6 text-primary/5" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-2xl"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><Sparkles className="h-4 w-4" />Learning library</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Training</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Call Center training guides and material, maintained by HR and administrators.</p></div>
        {canManage && <Button onClick={() => setEditor({ category: null })}><Plus className="h-4 w-4" />Add training tab</Button>}
      </div>
      <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-primary/15 pt-4 text-xs text-muted-foreground"><span className="rounded-full border border-primary/20 bg-background/60 px-3 py-1 font-semibold text-primary">{categories.length} training {categories.length === 1 ? 'area' : 'areas'}</span><span>{canManage ? 'Manager access · Add, edit, and archive categories and content' : 'Read-only · Showing training available to your department'}</span></div>
    </header>

    {!canView && <div role="note" className="glass-card flex items-start gap-3 p-6"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Call Center training</h2><p className="mt-1 text-sm text-muted-foreground">This training library is available only to Call Center employees. HR and Admin can manage its tabs and content.</p></div></div>}

    {isCallCenterEmployee && <section className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4 sm:px-7"><Coins className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">My sales commission</h2><p className="mt-1 text-xs text-muted-foreground">Your current and previous month sales record · read-only</p></div></div>
      {mySalesLoading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading your monthly statement…</p> : <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">{(mySalesData?.items || []).map(period => <article key={`${period.year}-${period.month}`} className="rounded-2xl border border-border bg-background/40 p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{new Date(period.year, period.month - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })}</h3><p className="font-bold text-primary">Rs. {Number(period.totalCommission || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</p></div>
        {period.items.length ? <div className="mt-3 divide-y divide-border">{period.items.map(item => <div key={item.slug} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{item.name}<span className="ml-2 text-xs text-muted-foreground">{item.quantity} sold{item.unit === 'percent' ? ` · sales Rs. ${Number(item.salesAmount || 0).toLocaleString('en-PK')}` : ''}</span></span><span className="font-medium">Rs. {Number(item.commissionAmount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No sales recorded for this month yet.</p>}
      </article>)}</div>}
    </section>}

    {canView && !isLoading && !isError && categories.length > 0 && <nav aria-label="Training categories" className="glass-card flex gap-2 overflow-x-auto p-3">
      {categories.map(category => <button key={category._id} type="button" aria-current={category._id === categoryId ? 'page' : undefined} onClick={() => navigate(`/training/${category._id}`)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${category._id === categoryId ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground'}`}>{category.name}</button>)}
    </nav>}

    {canView && isLoading && <div role="status" className="glass-card p-12 text-center text-muted-foreground">Loading training library…</div>}
    {isError && <div role="alert" className="glass-card space-y-3 p-8 text-center"><p>Unable to load training pages.</p><Button variant="secondary" onClick={refetch}>Try again</Button></div>}
    {canView && !isLoading && !isError && !categories.length && <div className="glass-card py-16 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-primary/60" /><h2 className="text-lg font-semibold">No training pages available</h2><p className="mt-2 text-sm text-muted-foreground">{canManage ? 'Add a training tab to start building the learning library.' : 'HR has not published a training page for the Call Center yet.'}</p>{canManage && <Button className="mt-5" onClick={() => setEditor({ category: null })}><Plus className="h-4 w-4" />Add first tab</Button>}</div>}

    {activeCategory && <article className="glass-card overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-transparent p-5 sm:p-8">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-background text-primary"><BookOpen className="h-6 w-6" /></span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{activeCategory.name}</h2><span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-semibold text-primary"><UsersRound className="h-3.5 w-3.5" />Call Center only</span></div>{activeCategory.summary && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{activeCategory.summary}</p>}</div>
          {activeCommission && <div className="col-span-2 justify-self-end rounded-xl border border-primary/20 bg-background/70 px-4 py-2.5 sm:col-span-1 sm:min-w-48 sm:justify-self-end">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Commission</p><p className="mt-1 text-base font-semibold text-primary">{activeCommission.unit === 'percent' ? `${activeCommission.amount}%` : `Rs. ${Number(activeCommission.amount).toLocaleString('en-PK')}`}</p>
          </div>}
          {canManage && <div className="col-start-2 flex justify-self-end gap-1 sm:col-start-auto"><Button variant="outline" size="sm" onClick={() => setEditor({ category: activeCategory })}><Pencil className="h-4 w-4" />Edit</Button><Button variant="ghost" size="icon" aria-label={`Remove ${activeCategory.name} training tab`} onClick={() => setDeleteTarget(activeCategory)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>}
        </div>
      </div>
      <div className="p-5 sm:p-8"><RuleContent blocks={activeCategory.blocks} /></div>
      <footer className="border-t border-border bg-background/30 px-5 py-3 text-xs text-muted-foreground sm:px-8">Training content · Revision {activeCategory.revision}</footer>
    </article>}

    {editor && <TrainingEditor key={editor.category?._id || 'new-training'} category={editor.category} onSave={save} onClose={() => setEditor(null)} saving={creating || updating} />}
    <ConfirmDialog isOpen={!!deleteTarget} title="Remove training tab?" message={`“${deleteTarget?.name || ''}” and its training details will be archived and hidden from employees. The archived record is retained for recovery.`} confirmLabel="Remove tab" isLoading={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={removeCategory} />
  </div>;
}
