import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Package, Plus, Search, Laptop, UserRound, Wrench, ShieldAlert,
  Box, RotateCcw, AlertTriangle, CalendarClock, History, Mouse, Headphones,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select } from '../../../components/ui/Input';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { toast } from '../../../utils/toast';
import { useListEmployeesQuery } from '../../employees/api/employees.api';
import {
  useGetAssetsDashboardQuery, useListAssetsQuery, useGetAssetQuery, useGetAssetTypesQuery, useCreateAssetTypeMutation,
  useCreateAssetMutation, useUpdateAssetMutation, useAssignAssetMutation,
  useReturnAssetMutation, useChangeAssetStatusMutation, useAddAssetMaintenanceMutation,
  useUpdateAssetMaintenanceMutation, useGetEmployeeAssetAllocationsQuery,
  useGetEmployeeAllocationOptionsQuery, useSyncEmployeeAssetsMutation,
} from '../api/assets.api';

const DEFAULT_CATEGORIES = ['Laptop', 'Desktop', 'Monitor', 'Mouse', 'Charger', 'Mobile Phone', 'SIM', 'Headset', 'Printer', 'Attendance Machine', 'Access Card', 'Office Keys'];
const STATUSES = ['in_stock', 'assigned', 'under_repair', 'returned', 'lost', 'stolen', 'retired', 'disposed'];
const STATUS_LABELS = Object.fromEntries(STATUSES.map(value => [value, value.replaceAll('_', ' ')]));
const STATUS_VARIANTS = { in_stock: 'green', assigned: 'blue', under_repair: 'yellow', returned: 'gray', lost: 'red', stolen: 'red', retired: 'purple', disposed: 'gray' };
const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary';
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = value => value ? new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formatMoney = value => `PKR ${Number(value || 0).toLocaleString()}`;
const canManageRole = role => ['hr', 'admin', 'super_admin'].includes(role);
const assetIcon = category => {
  const value = String(category || '').toLowerCase();
  if (value.includes('laptop') || value.includes('desktop') || value.includes('monitor')) return Laptop;
  if (value.includes('mouse')) return Mouse;
  if (value.includes('headset')) return Headphones;
  return Package;
};

function AssetTypeCard({ item }) {
  const Icon = assetIcon(item.category);
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{item.category}</p><p className="mt-1 text-3xl font-bold">{item.total}</p><p className="text-xs text-muted-foreground">Total units</p></div><div className="rounded-xl bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary"/></div></div>
    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-sm">
      <div className="rounded-xl bg-blue-500/10 p-3"><p className="text-xs text-muted-foreground">In Use</p><p className="mt-1 text-lg font-bold text-blue-600">{item.inUse}</p></div>
      <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-lg font-bold text-emerald-600">{item.available}</p></div>
      <div className="rounded-xl bg-amber-500/10 p-3"><p className="text-xs text-muted-foreground">Under Repair</p><p className="mt-1 text-lg font-bold text-amber-600">{item.underRepair}</p></div>
    </div>
  </article>;
}

function AssetForm({ initial, employees, categories, onAddType, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({
    employeeId: initial?.assignedEmployeeId?._id || '', category: initial?.category || 'Laptop',
    brand: initial?.brand || '', model: initial?.model || '', serialNumber: initial?.serialNumber || '',
    purchaseDate: initial?.purchaseDate?.slice?.(0, 10) || '', purchaseCost: initial?.purchaseCost || '',
    warrantyExpiryDate: initial?.warrantyExpiryDate?.slice?.(0, 10) || '',
    department: initial?.department || '', notes: initial?.notes || '', quantity: 1,
  });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const isSimplePeripheral = !initial && ['Mouse', 'Headset'].includes(form.category);
  const save = event => {
    event.preventDefault();
    if (isSimplePeripheral) {
      onSubmit({ category: form.category, brand: form.brand.trim(), quantity: Number(form.quantity) });
      return;
    }
    const standardForm = { ...form };
    delete standardForm.quantity;
    onSubmit({
      ...standardForm,
      ...(initial ? { employeeId: undefined } : {}),
      purchaseCost: Number(form.purchaseCost || 0),
      purchaseDate: form.purchaseDate || null,
      warrantyExpiryDate: form.warrantyExpiryDate || null,
    });
  };
  return <form onSubmit={save}>
    <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">Asset Type <span className="text-red-500">*</span></span><button type="button" title="Add asset type" aria-label="Add asset type" onClick={onAddType} className="rounded-lg p-1.5 text-primary transition hover:bg-primary/10"><Plus className="h-4 w-4"/></button></div><select required className={inputClass} value={form.category} onChange={e=>set('category',e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></div>
        {isSimplePeripheral ? <>
          <Input required label="Company / Brand" value={form.brand} onChange={e=>set('brand',e.target.value)} placeholder={`e.g. ${form.category==='Mouse'?'Logitech':'Jabra'}`} />
          <Input required label="Quantity" type="number" min="1" max="500" value={form.quantity} onChange={e=>set('quantity',e.target.value)} />
        </> : <>
          <Select label="Employee Name" value={form.employeeId} disabled={Boolean(initial)} onChange={e=>set('employeeId',e.target.value)}><option value="">Keep in stock (not assigned)</option>{employees.map(x=><option key={x._id} value={x._id}>{x.fullName} · {x.employeeCode}</option>)}</Select>
          <Input label="Serial Number" value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)} />
          <Input label="Brand" value={form.brand} onChange={e=>set('brand',e.target.value)} />
          <Input label="Model" value={form.model} onChange={e=>set('model',e.target.value)} />
          <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e=>set('purchaseDate',e.target.value)} />
          <Input label="Purchase Cost" type="number" min="0" value={form.purchaseCost} onChange={e=>set('purchaseCost',e.target.value)} />
          <Input label="Warranty Expiry" type="date" value={form.warrantyExpiryDate} onChange={e=>set('warrantyExpiryDate',e.target.value)} />
          <Input label="Department" value={form.department} onChange={e=>set('department',e.target.value)} />
        </>}
      </div>
      {!isSimplePeripheral&&<label className="block text-sm">Notes<textarea className={`${inputClass} mt-1 min-h-24`} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>}
    </div><ModalFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={loading}>{loading?'Saving...':'Save Asset'}</Button></ModalFooter>
  </form>;
}

function ActionForm({ type, employees, onSubmit, onClose, loading }) {
  const initial = type === 'assign'
    ? { employeeId:'', assignmentDate:today(), conditionAtAssignment:'Good', notes:'' }
    : type === 'return'
      ? { returnDate:today(), conditionAtReturn:'Good', notes:'' }
      : type === 'maintenance'
        ? { issue:'', reportedDate:today(), sentForRepairDate:'', vendorTechnician:'', repairCost:0, repairDetails:'', status:'in_repair', notes:'' }
        : { status:'under_repair', date:today(), reason:'', description:'', notes:'' };
  const [form,setForm]=useState(initial); const set=(k,v)=>setForm({...form,[k]:v});
  return <form onSubmit={e=>{e.preventDefault();const body={...form};if(type==='maintenance'){body.repairCost=Number(body.repairCost||0);body.sentForRepairDate=body.sentForRepairDate||null;}onSubmit(body);}}><div className="space-y-4 p-5">
    {type==='assign'&&<><Select required label="Employee" value={form.employeeId} onChange={e=>set('employeeId',e.target.value)}><option value="">Select employee</option>{employees.map(x=><option key={x._id} value={x._id}>{x.fullName} · {x.employeeCode}</option>)}</Select><Input label="Assignment Date" type="date" value={form.assignmentDate} onChange={e=>set('assignmentDate',e.target.value)}/><Input label="Condition" value={form.conditionAtAssignment} onChange={e=>set('conditionAtAssignment',e.target.value)}/></>}
    {type==='return'&&<><Input label="Return Date" type="date" value={form.returnDate} onChange={e=>set('returnDate',e.target.value)}/><Input label="Condition at Return" value={form.conditionAtReturn} onChange={e=>set('conditionAtReturn',e.target.value)}/></>}
    {type==='maintenance'&&<><Input required label="Issue" value={form.issue} onChange={e=>set('issue',e.target.value)}/><div className="grid gap-4 sm:grid-cols-2"><Input label="Reported Date" type="date" value={form.reportedDate} onChange={e=>set('reportedDate',e.target.value)}/><Input label="Sent for Repair" type="date" value={form.sentForRepairDate} onChange={e=>set('sentForRepairDate',e.target.value)}/><Input label="Vendor / Technician" value={form.vendorTechnician} onChange={e=>set('vendorTechnician',e.target.value)}/><Input label="Repair Cost" type="number" min="0" value={form.repairCost} onChange={e=>set('repairCost',e.target.value)}/></div><Input label="Repair Details" value={form.repairDetails} onChange={e=>set('repairDetails',e.target.value)}/></>}
    {type==='status'&&<><Select label="New Status" value={form.status} onChange={e=>set('status',e.target.value)}>{['in_stock','under_repair','lost','stolen','retired','disposed'].map(x=><option key={x} value={x}>{STATUS_LABELS[x]}</option>)}</Select><Input label="Date" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/><Input label="Reason" value={form.reason} onChange={e=>set('reason',e.target.value)}/>{['lost','stolen'].includes(form.status)&&<Input label="Incident Description" value={form.description} onChange={e=>set('description',e.target.value)}/>}</>}
    <label className="block text-sm">Notes<textarea className={`${inputClass} mt-1 min-h-20`} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
  </div><ModalFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={loading}>{loading?'Saving...':'Confirm'}</Button></ModalFooter></form>;
}

function EmployeeAllocationForm({ employee, onClose }) {
  const { data, isLoading } = useGetEmployeeAllocationOptionsQuery(employee?._id, { skip: !employee?._id });
  const [syncAssets, { isLoading: saving }] = useSyncEmployeeAssetsMutation();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(today());
  const [notes, setNotes] = useState('');
  const options = data?.data?.items || [];
  useEffect(() => setSelected((data?.data?.selectedAssetIds || []).map(String)), [data]);
  const visible = options.filter(asset => [asset.name, asset.category, asset.assetCode, asset.serialNumber, asset.brand, asset.model]
    .some(value => String(value || '').toLowerCase().includes(search.toLowerCase())));
  const toggle = id => setSelected(current => current.includes(String(id))
    ? current.filter(value => value !== String(id)) : [...current, String(id)]);
  const save = async event => {
    event.preventDefault();
    try {
      const result = await syncAssets({ employeeId: employee._id, assetIds: selected, assignmentDate, notes }).unwrap();
      toast.success(`${result.data.assigned} assigned and ${result.data.returned} returned.`);
      onClose();
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to update employee assets.');
    }
  };
  return <form onSubmit={save}>
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4"><Avatar name={employee.fullName}/><div><p className="font-semibold">{employee.fullName}</p><p className="text-xs text-muted-foreground">{employee.employeeCode} · {employee.department || 'No department'}</p></div><Badge className="ml-auto" variant="blue">{selected.length} selected</Badge></div>
      <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className={`${inputClass} pl-9`} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search laptop, mouse, headset, serial..."/></label>
      <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-2xl border border-border p-2">
        {isLoading ? <div className="space-y-2">{[1,2,3,4].map(item=><Skeleton key={item} className="h-16"/>)}</div> : visible.length ? visible.map(asset => {
          const checked = selected.includes(String(asset._id));
          const locked = asset.status === 'under_repair';
          return <label key={asset._id} className={`flex items-center gap-3 rounded-xl border p-3 transition ${checked?'border-primary/40 bg-primary/5':'border-border hover:border-primary/20'} ${locked?'cursor-not-allowed opacity-70':'cursor-pointer'}`}>
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} disabled={locked} onChange={()=>toggle(asset._id)}/>
            <div className="rounded-lg bg-primary/10 p-2"><Laptop className="h-4 w-4 text-primary"/></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset.name}</p><p className="truncate text-xs text-muted-foreground">{asset.category} · {asset.assetCode}{asset.serialNumber?` · ${asset.serialNumber}`:''}</p></div>
            <Badge variant={locked?'yellow':checked?'blue':'green'}>{locked?'Under repair':checked?'Assigned':'Available'}</Badge>
          </label>;
        }) : <p className="p-8 text-center text-sm text-muted-foreground">No matching available assets.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><Input required label="Assignment / Return Date" type="date" value={assignmentDate} onChange={event=>setAssignmentDate(event.target.value)}/><Input label="Notes" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Optional allocation note"/></div>
      <p className="text-xs text-muted-foreground">Check an available asset to assign it. Uncheck an assigned asset to record its return. Assets under repair remain locked.</p>
    </div><ModalFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving||isLoading}>{saving?'Saving...':'Save Allocation'}</Button></ModalFooter>
  </form>;
}

function AssetDetails({ asset, canManage, onEdit, onAction, onCompleteRepair }) {
  if (!asset) return null;
  return <div className="space-y-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4"><div><p className="text-lg font-bold">{asset.name}</p><p className="text-sm text-muted-foreground">{asset.assetCode} · {asset.category}</p></div><Badge variant={STATUS_VARIANTS[asset.status]}>{STATUS_LABELS[asset.status]}</Badge></div>
    {canManage&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>{['in_stock','returned'].includes(asset.status)&&<Button size="sm" onClick={()=>onAction('assign')}>Assign</Button>}{asset.assignedEmployeeId&&<Button size="sm" onClick={()=>onAction('return')}>Return</Button>}<Button size="sm" variant="outline" onClick={()=>onAction('maintenance')}><Wrench className="h-4 w-4"/> Maintenance</Button><Button size="sm" variant="outline" onClick={()=>onAction('status')}>Change Status</Button></div>}
    <section><h3 className="mb-2 font-semibold">General Information</h3><div className="grid gap-3 rounded-2xl border border-border p-4 text-sm sm:grid-cols-2">{[['Brand / Model',[asset.brand,asset.model].filter(Boolean).join(' ')||'—'],['Serial Number',asset.serialNumber||'—'],['Purchase',formatDate(asset.purchaseDate)],['Purchase Cost',formatMoney(asset.purchaseCost)],['Vendor',asset.vendor||'—'],['Warranty',formatDate(asset.warrantyExpiryDate)],['Department',asset.department||'—'],['Location',asset.location||'—'],['Condition',asset.condition||'—']].map(([a,b])=><div key={a}><p className="text-xs text-muted-foreground">{a}</p><p className="font-medium">{b}</p></div>)}</div></section>
    <section><h3 className="mb-2 font-semibold">Current Assignment</h3><div className="rounded-2xl border border-border p-4">{asset.assignedEmployeeId?<div className="flex items-center gap-3"><Avatar name={asset.assignedEmployeeId.fullName}/><div><p className="font-medium">{asset.assignedEmployeeId.fullName}</p><p className="text-xs text-muted-foreground">{asset.assignedEmployeeId.employeeCode} · {asset.assignedEmployeeId.department}</p></div></div>:<p className="text-sm text-muted-foreground">Asset is not assigned.</p>}</div></section>
    {(asset.network?.ipAddress||asset.network?.macAddress||asset.network?.hostname)&&<section><h3 className="mb-2 font-semibold">Network (Manual)</h3><div className="grid gap-3 rounded-2xl border border-border p-4 text-sm sm:grid-cols-2"><p>IP: <b>{asset.network.ipAddress||'—'}</b></p><p>MAC: <b>{asset.network.macAddress||'—'}</b></p><p>Hostname: <b>{asset.network.hostname||'—'}</b></p><p>Presence: <b className="capitalize">{asset.network.presenceStatus||'unknown'}</b></p></div></section>}
    <section><div className="mb-2 flex justify-between"><h3 className="font-semibold">Maintenance</h3><p className="text-sm text-muted-foreground">{asset.maintenanceSummary?.repairs||0} records · {formatMoney(asset.maintenanceSummary?.totalCost)}</p></div><div className="space-y-2">{asset.maintenance?.length?asset.maintenance.map(item=><div key={item._id} className="rounded-xl border border-border p-3 text-sm"><div className="flex justify-between gap-3"><p className="font-medium">{item.issue}</p><Badge variant={item.status==='completed'?'green':'yellow'}>{item.status.replaceAll('_',' ')}</Badge></div><p className="mt-1 text-muted-foreground">{formatDate(item.reportedDate)} · {item.vendorTechnician||'No vendor'} · {formatMoney(item.repairCost)}</p>{canManage&&item.status!=='completed'&&<Button className="mt-2" size="sm" variant="outline" onClick={()=>onCompleteRepair(item)}>Mark Completed</Button>}</div>):<p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No maintenance history.</p>}</div></section>
    <section><h3 className="mb-2 font-semibold">Assignment & Lifecycle History</h3><div className="space-y-2">{asset.history?.map(item=><div key={item._id} className="flex gap-3 rounded-xl border border-border p-3 text-sm"><History className="mt-0.5 h-4 w-4 text-primary"/><div><p className="font-medium capitalize">{item.action.replaceAll('_',' ')}</p><p className="text-xs text-muted-foreground">{formatDate(item.createdAt)} · {item.changedBy?.fullName||'System'}{item.notes?` · ${item.notes}`:''}</p></div></div>)}</div></section>
  </div>;
}

export default function AssetsPage() {
  const user=useSelector(s=>s.auth.user); const canManage=canManageRole(user?.role);
  const [filters,setFilters]=useState({search:'',status:'',category:'',employeeId:'',warranty:''});
  const [selected,setSelected]=useState(null); const [assetForm,setAssetForm]=useState(null); const [action,setAction]=useState(null);
  const [typeModal,setTypeModal]=useState(false); const [newType,setNewType]=useState('');
  const [allocationEmployee,setAllocationEmployee]=useState(null); const [employeeSearch,setEmployeeSearch]=useState('');
  const [showInventory,setShowInventory]=useState(false);
  const {data:typeData}=useGetAssetTypesQuery();
  const {data:dashboard,isLoading:dashLoading}=useGetAssetsDashboardQuery();
  const {data:list,isLoading}=useListAssetsQuery({...filters,limit:100});
  const {data:details,refetch:refetchDetail}=useGetAssetQuery(selected,{skip:!selected});
  const {data:employeeData}=useListEmployeesQuery({page:1,limit:100,status:'active'},{skip:!canManage});
  const {data:allocationData}=useGetEmployeeAssetAllocationsQuery(undefined,{skip:!canManage});
  const employees=employeeData?.items||[]; const assets=list?.items||[];
  const [createAsset,{isLoading:creating}]=useCreateAssetMutation(); const [updateAsset,{isLoading:updating}]=useUpdateAssetMutation();
  const [createAssetType,{isLoading:creatingType}]=useCreateAssetTypeMutation();
  const [assignAsset,{isLoading:assigning}]=useAssignAssetMutation(); const [returnAsset,{isLoading:returning}]=useReturnAssetMutation();
  const [changeStatus,{isLoading:changing}]=useChangeAssetStatusMutation(); const [addMaintenance,{isLoading:maintaining}]=useAddAssetMaintenanceMutation(); const [updateMaintenance]=useUpdateAssetMaintenanceMutation();
  const mutate=async(promise,message,close=true)=>{try{await promise.unwrap();toast.success(message);if(close){setAssetForm(null);setAction(null);}if(selected)refetchDetail();}catch(error){toast.error(error?.data?.error?.message||'Action failed.');}};
  const stats=dashboard?.data||{};
  const categories=(typeData?.data||DEFAULT_CATEGORIES).filter(category=>String(category).toLowerCase()!=='keyboard');
  const assetTypeStats=(stats.categoryBreakdown||[]).filter(item=>String(item.category).toLowerCase()!=='keyboard');
  const allocationMap=useMemo(()=>new Map((allocationData?.data||[]).map(item=>[String(item.employeeId),item])),[allocationData]);
  const visibleEmployees=employees.filter(employee=>[employee.fullName,employee.employeeCode,employee.department].some(value=>String(value||'').toLowerCase().includes(employeeSearch.toLowerCase())));
  const saveAsset=body=>assetForm?mutate(updateAsset({id:assetForm._id,...body}),'Asset updated.'):mutate(createAsset(body),'Asset created.');
  const saveType=async event=>{event.preventDefault();try{await createAssetType({name:newType}).unwrap();toast.success('Asset type added.');setNewType('');setTypeModal(false);}catch(error){toast.error(error?.data?.error?.message||'Unable to add asset type.');}};
  const submitAction=body=>{const calls={assign:assignAsset,return:returnAsset,maintenance:addMaintenance,status:changeStatus};return mutate(calls[action]({id:selected,...body}),`${action.replaceAll('_',' ')} updated.`);};
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Package className="text-primary"/> Assets</h1><p className="text-sm text-muted-foreground">Inventory, assignments, returns, maintenance and asset clearance.</p></div>{canManage&&<Button onClick={()=>setAssetForm(false)}><Plus className="h-4 w-4"/> Add Asset</Button>}</div>
    {dashLoading?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(item=><Skeleton key={item} className="h-64"/>)}</div>:assetTypeStats.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{assetTypeStats.map(item=><AssetTypeCard key={item.category} item={item}/>)}</div>:<div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-medium">No asset inventory yet</p><p className="text-sm text-muted-foreground">Add an asset to see type-wise availability and repair statistics.</p></div>}
    {canManage&&<section className="space-y-4 rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Employee Asset Allocation</h2><p className="text-sm text-muted-foreground">Select an employee to assign or return multiple assets.</p></div><div className="flex w-full gap-2 sm:w-auto"><label className="relative flex-1 sm:w-80"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className={`${inputClass} pl-9`} placeholder="Search employee..." value={employeeSearch} onChange={event=>setEmployeeSearch(event.target.value)}/></label><Button type="button" variant="outline" onClick={()=>setShowInventory(value=>!value)}>{showInventory?'Hide Inventory':'View Inventory'}</Button></div></div><div className="grid max-h-[28rem] gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{visibleEmployees.map(employee=>{const allocation=allocationMap.get(String(employee._id))||{count:0,categories:[]};return <button key={employee._id} type="button" onClick={()=>setAllocationEmployee(employee)} className="rounded-xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"><div className="flex items-center gap-3"><Avatar name={employee.fullName}/><div className="min-w-0 flex-1"><p className="truncate font-semibold">{employee.fullName}</p><p className="truncate text-xs text-muted-foreground">{employee.employeeCode} · {employee.department||'No department'}</p></div><Badge variant={allocation.count?'blue':'gray'}>{allocation.count}</Badge></div><p className="mt-3 truncate border-t border-border pt-3 text-xs text-muted-foreground">{allocation.categories.length?allocation.categories.join(', '):'No assets assigned'}</p></button>;})}</div></section>}
    <div className={canManage&&!showInventory?'hidden':'contents'}>
    <div className="rounded-2xl border border-border bg-card p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className={`${inputClass} pl-9`} placeholder="Search assets..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label><select className={inputClass} value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All Statuses</option>{STATUSES.map(x=><option key={x} value={x}>{STATUS_LABELS[x]}</option>)}</select><select className={inputClass} value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All Types</option>{categories.map(x=><option key={x}>{x}</option>)}</select>{canManage&&<select className={inputClass} value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}><option value="">All Employees</option>{employees.map(x=><option key={x._id} value={x._id}>{x.fullName}</option>)}</select>}<select className={inputClass} value={filters.warranty} onChange={e=>setFilters({...filters,warranty:e.target.value})}><option value="">All Warranties</option><option value="expiring">Expiring in 30 days</option><option value="expired">Expired</option></select></div></div>
    {isLoading?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(x=><Skeleton key={x} className="h-44"/>)}</div>:assets.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{assets.map(asset=><button key={asset._id} type="button" onClick={()=>setSelected(asset._id)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><Laptop className="h-5 w-5 text-primary"/></div><div className="min-w-0"><p className="truncate font-semibold">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.assetCode} · {asset.category}</p></div></div><Badge variant={STATUS_VARIANTS[asset.status]}>{STATUS_LABELS[asset.status]}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm"><p><span className="text-xs text-muted-foreground">Brand / Model</span><br/><b>{[asset.brand,asset.model].filter(Boolean).join(' ')||'—'}</b></p><p><span className="text-xs text-muted-foreground">Assigned To</span><br/><b>{asset.assignedEmployeeId?.fullName||'Available'}</b></p><p><span className="text-xs text-muted-foreground">Serial</span><br/><b>{asset.serialNumber||'—'}</b></p><p><span className="text-xs text-muted-foreground">Warranty</span><br/><b>{formatDate(asset.warrantyExpiryDate)}</b></p></div></button>)}</div>:<div className="rounded-2xl border border-border bg-card p-16 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-medium">No assets found</p><p className="text-sm text-muted-foreground">{canManage?'Add your first company asset.':'No assets are currently assigned to you.'}</p></div>}
    </div>
    <Modal isOpen={Boolean(selected)} onClose={()=>setSelected(null)} title="Asset Details" size="xl"><AssetDetails asset={details?.data} canManage={canManage} onEdit={()=>setAssetForm(details.data)} onAction={setAction} onCompleteRepair={item=>mutate(updateMaintenance({id:selected,maintenanceId:item._id,status:'completed',completionDate:today()}),'Repair completed.',false)}/></Modal>
    <Modal isOpen={assetForm!==null} onClose={()=>setAssetForm(null)} title={assetForm?'Edit Asset':'Add Asset'} size="xl"><AssetForm key={assetForm?._id||'new'} initial={assetForm||null} employees={employees} categories={categories} onAddType={()=>setTypeModal(true)} onSubmit={saveAsset} onClose={()=>setAssetForm(null)} loading={creating||updating}/></Modal>
    <Modal isOpen={typeModal} onClose={()=>setTypeModal(false)} title="Add Asset Type" size="sm"><form onSubmit={saveType}><div className="p-5"><Input required autoFocus label="Asset Type Name" value={newType} onChange={e=>setNewType(e.target.value)} placeholder="e.g. Tablet"/></div><ModalFooter><Button type="button" variant="ghost" onClick={()=>setTypeModal(false)}>Cancel</Button><Button type="submit" disabled={creatingType}>{creatingType?'Adding...':'Add Type'}</Button></ModalFooter></form></Modal>
    <Modal isOpen={Boolean(action)} onClose={()=>setAction(null)} title={{assign:'Assign Asset',return:'Return Asset',maintenance:'Add Maintenance',status:'Change Asset Status'}[action]||'Asset Action'} size="md">{action&&<ActionForm key={action} type={action} employees={employees} onSubmit={submitAction} onClose={()=>setAction(null)} loading={assigning||returning||changing||maintaining}/>}</Modal>
    <Modal isOpen={Boolean(allocationEmployee)} onClose={()=>setAllocationEmployee(null)} title="Employee Asset Allocation" size="lg">{allocationEmployee&&<EmployeeAllocationForm employee={allocationEmployee} onClose={()=>setAllocationEmployee(null)}/>}</Modal>
  </div>;
}
