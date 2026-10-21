import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Modal, ModalFooter } from '../../../components/ui/Modal';

const fieldClass = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function TrainingEditor({ category, departments, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name: category?.name || '',
    summary: category?.summary || '',
    audience: category?.audience || 'all',
    departments: category?.departments || [],
    blocks: category?.blocks?.map(block => ({ ...block })) || [{ type: 'paragraph', text: '' }],
  });
  const [error, setError] = useState('');

  function change(fields) { setForm(previous => ({ ...previous, ...fields })); }
  function changeBlock(index, fields) {
    change({ blocks: form.blocks.map((block, i) => i === index ? { ...block, ...fields } : block) });
  }
  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.blocks.length || form.blocks.some(block => !block.text.trim())) {
      setError('Add a category name and fill in every content block.'); return;
    }
    if (form.audience === 'department' && !form.departments.length) {
      setError('Choose at least one department for this training.'); return;
    }
    setError('');
    try { await onSave({ ...form, ...(category ? { revision: category.revision } : {}) }); }
    catch (err) { setError(err?.data?.error?.message || 'Could not save this training page. Please try again.'); }
  }

  return <Modal isOpen onClose={() => !saving && onClose()} title={category ? 'Edit training tab' : 'Add training tab'} size="xl">
    <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium"><span>Tab name *</span><input required maxLength={100} className={fieldClass} value={form.name} onChange={event => change({ name: event.target.value })} placeholder="e.g. Customer Service" /></label>
        <label className="space-y-2 text-sm font-medium"><span>Short description</span><input maxLength={400} className={fieldClass} value={form.summary} onChange={event => change({ summary: event.target.value })} placeholder="What this training covers" /></label>
      </div>
      <fieldset className="space-y-3 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Who can access this training?</legend>
        <div className="flex flex-wrap gap-3">
          {[['all', 'All departments'], ['department', 'Selected departments']].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${form.audience === value ? 'border-primary bg-primary/10' : 'border-border'}`}><input type="radio" name="training-audience" checked={form.audience === value} onChange={() => change({ audience: value, departments: value === 'all' ? [] : form.departments })} />{label}</label>)}
        </div>
        {form.audience === 'department' && <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">{departments.map(department => <label key={department} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"><input type="checkbox" checked={form.departments.includes(department.toLowerCase())} onChange={event => change({ departments: event.target.checked ? [...form.departments, department.toLowerCase()] : form.departments.filter(name => name !== department.toLowerCase()) })} />{department}</label>)}{!departments.length && <p className="text-xs text-muted-foreground">No departments found yet. Add a department in Employee settings first.</p>}</div>}
      </fieldset>
      <div className="space-y-3">
        <div><h3 className="font-semibold">Training details</h3><p className="text-xs text-muted-foreground">Build the page with headings, text, or lists. HTML is not rendered.</p></div>
        {form.blocks.map((block, index) => <div key={index} className="rounded-2xl border border-border bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content block {index + 1}</span><div className="flex items-center gap-2"><select aria-label={`Content block ${index + 1} type`} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={block.type} onChange={event => changeBlock(index, { type: event.target.value })}><option value="heading">Heading</option><option value="paragraph">Text</option><option value="bullets">Bullet list</option><option value="numbered">Numbered list</option></select><Button type="button" variant="ghost" size="icon" aria-label={`Remove content block ${index + 1}`} disabled={form.blocks.length <= 1} onClick={() => change({ blocks: form.blocks.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>
          <textarea required rows={block.type === 'heading' ? 2 : 4} maxLength={block.type === 'heading' ? 200 : 10000} className={fieldClass} value={block.text} onChange={event => changeBlock(index, { text: event.target.value })} placeholder={['bullets', 'numbered'].includes(block.type) ? 'Put one item on each line' : block.type === 'heading' ? 'Section heading' : 'Write training information here'} />
        </div>)}
        <div className="flex flex-wrap gap-2">{[['heading', 'Heading'], ['paragraph', 'Text'], ['bullets', 'Bullets'], ['numbered', 'Numbered list']].map(([type, label]) => <Button key={type} type="button" variant="outline" size="sm" disabled={form.blocks.length >= 40} onClick={() => change({ blocks: [...form.blocks, { type, text: '' }] })}><Plus className="h-3.5 w-3.5" />{label}</Button>)}</div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <ModalFooter><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}><Save className="h-4 w-4" />{category ? 'Save changes' : 'Create tab'}</Button></ModalFooter>
    </form>
  </Modal>;
}
