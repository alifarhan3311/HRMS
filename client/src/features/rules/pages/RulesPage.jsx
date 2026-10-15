import { useState } from 'react';
import { useSelector } from 'react-redux';
import { BookOpen, Plus, Search, Pencil, Trash2, ArrowUpRight, ShieldCheck } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { toast } from '../../../utils/toast';
import { useListRulesQuery, useCreateRuleMutation, useUpdateRuleMutation, useDeleteRuleMutation } from '../api/rules.api';
import RuleContent from '../components/RuleContent';
import RuleEditor from '../components/RuleEditor';

export default function RulesPage() {
  const canManage = useSelector(state => state.auth.user?.role === 'hr');
  const { data, isLoading, isError, refetch } = useListRulesQuery(undefined, { refetchOnMountOrArgChange: true, refetchOnFocus: true });
  const [createRule, { isLoading: creating }] = useCreateRuleMutation();
  const [updateRule, { isLoading: updating }] = useUpdateRuleMutation();
  const [deleteRule, { isLoading: deleting }] = useDeleteRuleMutation();
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const rules = data?.items || [];
  const query = search.trim().toLowerCase();
  const visible = rules.filter(rule => [rule.title, rule.summary, ...rule.blocks.map(block => block.text)].some(text => text.toLowerCase().includes(query)));
  async function save(payload) {
    if (editor.rule) await updateRule({ id: editor.rule._id, ...payload }).unwrap();
    else await createRule(payload).unwrap();
    toast.success(editor.rule ? 'Regulation updated' : 'Regulation published');
    setEditor(null);
  }
  async function remove() {
    try {
      await deleteRule({ id: deleteTarget._id, revision: deleteTarget.revision }).unwrap();
      toast.success('Regulation removed from the handbook'); setDeleteTarget(null);
    } catch (err) { toast.error(err?.data?.error?.message || 'Unable to delete regulation'); }
  }
  if (editor && canManage) return <RuleEditor key={editor.rule?._id || 'new'} rule={editor.rule} onSave={save} onClose={() => setEditor(null)} saving={creating || updating} />;
  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-9">
      <BookOpen aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-56 w-56 rotate-12 text-primary/5" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-2xl"><p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><ShieldCheck className="h-4 w-4" />Company handbook</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Rules &amp; Regulations</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">A shared guide to how we work. Read the latest company guidelines, maintained by HR.</p></div>
        {canManage && <Button onClick={() => setEditor({ rule: null })}><Plus className="h-4 w-4" />Add Regulation</Button>}
      </div>
      <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-primary/15 pt-5"><span className="rounded-full border border-primary/20 bg-background/60 px-3 py-1 text-xs font-medium">{rules.length} published {rules.length === 1 ? 'regulation' : 'regulations'}</span><span className="text-xs text-muted-foreground">{canManage ? 'HR workspace · Create, update and manage' : 'Read-only · Managed by HR'}</span></div>
    </header>
    <label className="flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Search regulations" placeholder="Search headings, text or a rule..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" /></label>
    {isLoading ? <p role="status" className="py-12 text-center text-muted-foreground">Loading the handbook...</p> : isError ? <div role="alert" className="glass-card space-y-3 p-8"><p>Unable to load regulations.</p><Button variant="secondary" onClick={refetch}>Try Again</Button></div> : !visible.length ? <div className="glass-card py-16 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-primary/60" /><h2 className="text-lg font-semibold">{query ? 'No matching regulations' : 'Your handbook starts here'}</h2><p className="mt-2 text-sm text-muted-foreground">{query ? 'Try a different keyword.' : canManage ? 'Add your first regulation with headings, text and lists.' : 'HR has not published any regulations yet.'}</p></div> : <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Handbook contents" className="glass-card space-y-2 p-4 lg:sticky lg:top-4"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">In this handbook</p>{visible.map((rule, i) => <a key={rule._id} href={`#rule-${rule._id}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-primary/10 hover:text-primary"><span className="text-xs font-semibold text-primary">{String(i + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 break-words">{rule.title}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a>)}</nav>
      <div className="min-w-0 space-y-6">{visible.map((rule, i) => <article id={`rule-${rule._id}`} key={rule._id} className="glass-card scroll-mt-24 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 border-b border-border bg-primary/5 p-5 sm:p-7"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-background text-sm font-bold text-primary">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><h2 className="break-words text-xl font-bold tracking-tight">{rule.title}</h2>{rule.summary && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{rule.summary}</p>}</div>{canManage && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${rule.title}`} onClick={() => setEditor({ rule })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${rule.title}`} onClick={() => setDeleteTarget(rule)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>}</div>
        <div className="p-5 sm:p-7"><RuleContent blocks={rule.blocks} /></div>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-7"><span>Maintained by HR · Revision {rule.revision}</span><span>Updated {new Date(rule.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</span></footer>
      </article>)}</div>
    </div>}
    <ConfirmDialog isOpen={!!deleteTarget} title="Delete regulation?" message={`“${deleteTarget?.title || ''}” will be removed for all employees. An archived database record will be retained.`} confirmLabel="Delete Regulation" isLoading={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={remove} />
  </div>;
}
