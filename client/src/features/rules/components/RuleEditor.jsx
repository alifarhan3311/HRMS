import { useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Eye, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import RuleContent from './RuleContent';

const TYPES = { heading: 'Heading', paragraph: 'Text', bullets: 'Bullet list', numbered: 'Numbered list' };
const fieldClass = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function RuleEditor({ rule, departments = [], onSave, onClose, saving }) {
  const [form, setForm] = useState({ title: rule?.title || '', summary: rule?.summary || '', audience: rule?.audience || 'all', departments: rule?.departments?.length ? rule.departments : rule?.department ? [rule.department] : [], blocks: rule?.blocks?.map(block => ({ ...block })) || [{ type: 'paragraph', text: '' }] });
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  function update(change) { setDirty(true); setForm(previous => ({ ...previous, ...change })); }
  function blockChange(index, change) { update({ blocks: form.blocks.map((block, i) => i === index ? { ...block, ...change } : block) }); }
  function move(index, delta) {
    const blocks = [...form.blocks];
    [blocks[index], blocks[index + delta]] = [blocks[index + delta], blocks[index]];
    update({ blocks });
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || form.blocks.some(block => !block.text.trim())) {
      setError('Add a title and fill every content block, or remove empty blocks.'); return;
    }
    if (form.audience === 'department' && !form.departments.length) {
      setError('Select at least one department this regulation applies to.'); return;
    }
    setError('');
    try { await onSave({ ...form, ...(rule ? { revision: rule.revision } : {}) }); }
    catch (err) { setError(err?.data?.error?.message || 'Unable to save. Your changes are still here; please try again.'); }
  }
  return <div className="space-y-5">
    <button type="button" disabled={saving} onClick={() => dirty ? setDiscard(true) : onClose()} className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4" />Back to handbook</button>
    <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">HR EDITOR</p><h1 className="mt-1 text-2xl font-bold">{rule ? 'Edit regulation' : 'Create a regulation'}</h1><p className="mt-1 text-sm text-muted-foreground">Choose who can see it, then build it with headings, text and lists.</p></div>
    <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-2">
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <div className="glass-card space-y-4 p-5">
          <label className="block space-y-2 text-sm font-medium"><span>Title *</span><input required maxLength={160} className={fieldClass} value={form.title} onChange={e => update({ title: e.target.value })} placeholder="e.g. Workplace guidelines" /></label>
          <label className="block space-y-2 text-sm font-medium"><span>Short introduction <span className="font-normal text-muted-foreground">(optional)</span></span><textarea rows={2} maxLength={300} className={fieldClass} value={form.summary} onChange={e => update({ summary: e.target.value })} placeholder="A short overview of this regulation" /></label>
          <fieldset className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"><legend className="px-1 text-sm font-semibold">Who can see this regulation? *</legend>
            <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.audience === 'all' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}><input type="radio" name="audience" value="all" checked={form.audience === 'all'} onChange={() => update({ audience: 'all', departments: [] })} /><span><span className="block text-sm font-medium">All Departments</span><span className="text-xs text-muted-foreground">Every employee can see this rule.</span></span></label>
            <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.audience === 'department' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}><input type="radio" name="audience" value="department" checked={form.audience === 'department'} onChange={() => update({ audience: 'department' })} /><span><span className="block text-sm font-medium">Specific Departments</span><span className="text-xs text-muted-foreground">Choose one or more departments that can see this rule.</span></span></label>
            {form.audience === 'department' && <div className="space-y-2"><p className="text-sm font-medium">Select departments *</p><div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:grid-cols-2">{departments.map(department => <label key={department} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"><input type="checkbox" checked={form.departments.includes(department)} onChange={event => update({ departments: event.target.checked ? [...form.departments, department] : form.departments.filter(item => item !== department) })} />{department}</label>)}</div>{!departments.length && <span className="block text-xs font-normal text-destructive">No departments are available. Create a department first in Employees.</span>}</div>}
          </fieldset>
        </div>
        {form.blocks.map((block, index) => <div key={index} className="glass-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><span>{String(index + 1).padStart(2, '0')}</span><select aria-label={`Block ${index + 1} type`} value={block.type} onChange={e => blockChange(index, { type: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move block ${index + 1} down`} disabled={index === form.blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove block ${index + 1}`} disabled={form.blocks.length === 1} onClick={() => update({ blocks: form.blocks.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
          <textarea required aria-label={`Block ${index + 1} content`} maxLength={block.type === 'heading' ? 200 : 10000} rows={block.type === 'heading' ? 2 : 5} className={fieldClass} value={block.text} onChange={e => blockChange(index, { text: e.target.value })} placeholder={['bullets', 'numbered'].includes(block.type) ? 'Write one list item per line...' : `Write your ${TYPES[block.type].toLowerCase()}...`} />
          {['bullets', 'numbered'].includes(block.type) && <p className="mt-1 text-xs text-muted-foreground">One item per line · Maximum 50 items · Bullets/numbers are added automatically.</p>}
        </div>)}
        <div className="flex flex-wrap gap-2">{Object.entries(TYPES).map(([type, label]) => <Button key={type} type="button" variant="outline" size="sm" disabled={form.blocks.length >= 40} onClick={() => update({ blocks: [...form.blocks, { type, text: '' }] })}><Plus className="h-3.5 w-3.5" />{label}</Button>)}</div>
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button><Button type="submit" loading={saving}><Save className="h-4 w-4" />{rule ? 'Save Changes' : 'Publish Regulation'}</Button></div>
      </fieldset>
      <aside className="glass-card min-w-0 overflow-hidden xl:sticky xl:top-4">
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-primary"><Eye className="h-4 w-4" />Live preview</div>
        <div className="max-h-[75vh] space-y-6 overflow-y-auto p-6 sm:p-8"><div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{form.audience === 'all' ? 'All Departments' : form.departments.length ? form.departments.join(' · ') : 'Select Departments'}</span><h2 className="mt-3 break-words text-2xl font-bold">{form.title || 'Your regulation title'}</h2>{form.summary && <p className="mt-3 whitespace-pre-wrap break-words text-muted-foreground">{form.summary}</p>}</div><RuleContent blocks={form.blocks} /></div>
      </aside>
    </form>
    <ConfirmDialog isOpen={discard} title="Discard unsaved changes?" message="Your unsaved edits will be lost. Published regulations will not be changed." confirmLabel="Discard Changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />
  </div>;
}
