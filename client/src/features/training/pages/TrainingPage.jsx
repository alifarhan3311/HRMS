import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BookOpen, GraduationCap, Plus, Pencil, Trash2, UsersRound, Sparkles } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { toast } from '../../../utils/toast';
import { useGetEmployeeDepartmentsQuery } from '../../employees/api/employees.api';
import RuleContent from '../../rules/components/RuleContent';
import TrainingEditor from '../components/TrainingEditor';
import {
  useCreateTrainingCategoryMutation,
  useDeleteTrainingCategoryMutation,
  useListTrainingCategoriesQuery,
  useUpdateTrainingCategoryMutation,
} from '../api/training.api';

export default function TrainingPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const role = useSelector(state => state.auth.user?.role);
  const canManage = ['admin', 'hr', 'super_admin'].includes(role);
  const { data, isLoading, isError, refetch } = useListTrainingCategoriesQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: departmentData } = useGetEmployeeDepartmentsQuery(undefined, { skip: !canManage });
  const [createCategory, { isLoading: creating }] = useCreateTrainingCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateTrainingCategoryMutation();
  const [deleteCategory, { isLoading: deleting }] = useDeleteTrainingCategoryMutation();
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const categories = data?.items || [];
  const activeCategory = useMemo(() => categories.find(category => category._id === categoryId), [categories, categoryId]);
  const departments = departmentData?.data?.data || [];

  useEffect(() => {
    if (!isLoading && categories.length && !categoryId) navigate(`/training/${categories[0]._id}`, { replace: true });
  }, [categories, categoryId, isLoading, navigate]);
  useEffect(() => {
    if (!isLoading && categoryId && categories.length && !activeCategory) navigate('/training', { replace: true });
  }, [activeCategory, categories.length, categoryId, isLoading, navigate]);

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
        <div className="max-w-2xl"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><Sparkles className="h-4 w-4" />Learning library</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Training</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Department-focused guides and training material, maintained by HR and administrators.</p></div>
        {canManage && <Button onClick={() => setEditor({ category: null })}><Plus className="h-4 w-4" />Add training tab</Button>}
      </div>
      <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-primary/15 pt-4 text-xs text-muted-foreground"><span className="rounded-full border border-primary/20 bg-background/60 px-3 py-1 font-semibold text-primary">{categories.length} training {categories.length === 1 ? 'area' : 'areas'}</span><span>{canManage ? 'Manager access · Add, edit, and archive categories and content' : 'Read-only · Showing training available to your department'}</span></div>
    </header>

    {!isLoading && !isError && categories.length > 0 && <nav aria-label="Training categories" className="glass-card flex gap-2 overflow-x-auto p-3">
      {categories.map(category => <button key={category._id} type="button" aria-current={category._id === categoryId ? 'page' : undefined} onClick={() => navigate(`/training/${category._id}`)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${category._id === categoryId ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground'}`}>{category.name}</button>)}
    </nav>}

    {isLoading && <div role="status" className="glass-card p-12 text-center text-muted-foreground">Loading training library…</div>}
    {isError && <div role="alert" className="glass-card space-y-3 p-8 text-center"><p>Unable to load training pages.</p><Button variant="secondary" onClick={refetch}>Try again</Button></div>}
    {!isLoading && !isError && !categories.length && <div className="glass-card py-16 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-primary/60" /><h2 className="text-lg font-semibold">No training pages available</h2><p className="mt-2 text-sm text-muted-foreground">{canManage ? 'Add a training tab to start building the learning library.' : 'HR has not published a training page for your department yet.'}</p>{canManage && <Button className="mt-5" onClick={() => setEditor({ category: null })}><Plus className="h-4 w-4" />Add first tab</Button>}</div>}

    {activeCategory && <article className="glass-card overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-transparent p-5 sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-background text-primary"><BookOpen className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{activeCategory.name}</h2><span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-semibold text-primary"><UsersRound className="h-3.5 w-3.5" />{activeCategory.audience === 'all' ? 'All departments' : activeCategory.departments.join(' · ')}</span></div>{activeCategory.summary && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{activeCategory.summary}</p>}</div>
          {canManage && <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => setEditor({ category: activeCategory })}><Pencil className="h-4 w-4" />Edit</Button><Button variant="ghost" size="icon" aria-label={`Remove ${activeCategory.name} training tab`} onClick={() => setDeleteTarget(activeCategory)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>}
        </div>
      </div>
      <div className="p-5 sm:p-8"><RuleContent blocks={activeCategory.blocks} /></div>
      <footer className="border-t border-border bg-background/30 px-5 py-3 text-xs text-muted-foreground sm:px-8">Training content · Revision {activeCategory.revision}</footer>
    </article>}

    {editor && <TrainingEditor key={editor.category?._id || 'new-training'} category={editor.category} departments={departments} onSave={save} onClose={() => setEditor(null)} saving={creating || updating} />}
    <ConfirmDialog isOpen={!!deleteTarget} title="Remove training tab?" message={`“${deleteTarget?.name || ''}” and its training details will be archived and hidden from employees. The archived record is retained for recovery.`} confirmLabel="Remove tab" isLoading={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={removeCategory} />
  </div>;
}
