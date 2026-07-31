import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useGetActionCenterQuery } from '../api/actionCenter.api';

const severity = {
  danger: 'border-destructive/30 bg-destructive/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-blue-500/30 bg-blue-500/5',
};

export default function ActionCenterPage() {
  const { data, isLoading, isError, refetch, isFetching } = useGetActionCenterQuery(undefined, {
    pollingInterval: 60000,
    refetchOnMountOrArgChange: true,
  });
  const center = data?.data;
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><AlertTriangle className="text-primary"/> HR Action Center</h1><p className="text-sm text-muted-foreground">Everything requiring HR attention in one place.</p></div>
      <Button variant="outline" loading={isFetching} onClick={refetch}><RefreshCw className="h-4 w-4"/> Refresh</Button>
    </div>
    {isLoading && <div className="rounded-2xl border border-border bg-card p-12 text-center">Loading actions...</div>}
    {isError && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">Unable to load HR actions.</div>}
    {center && <>
      <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Open actions</p><p className="text-3xl font-bold">{center.total}</p><p className="mt-1 text-xs text-muted-foreground">Last checked {new Date(center.generatedAt).toLocaleString('en-PK')}</p></div>
      {center.total === 0 && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-12 text-center"><CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500"/><h2 className="font-semibold">All clear</h2><p className="text-sm text-muted-foreground">There are no pending HR actions.</p></div>}
      <div className="grid gap-4 lg:grid-cols-2">{center.groups.map((group, index) => <motion.section key={group.key} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:index*.035}} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{group.title}</h2><p className="text-xs text-muted-foreground">{group.items.length} open</p></div>{group.items.length > 0 && <Link to={group.link} className="flex items-center gap-1 text-xs font-semibold text-primary">Open module <ArrowRight className="h-3 w-3"/></Link>}</div>
        {!group.items.length ? <p className="py-6 text-center text-sm text-muted-foreground">No action required</p> : <div className="space-y-2">{group.items.map(x => <Link key={`${group.key}-${x.id}`} to={x.link} className={`block rounded-xl border p-3 transition hover:border-primary/50 ${severity[x.severity] || severity.warning}`}><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{x.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{x.subtitle}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0"/></div>{x.date && <p className="mt-2 text-[11px] text-muted-foreground">{new Date(x.date).toLocaleString('en-PK')}</p>}</Link>)}</div>}
      </motion.section>)}</div>
    </>}
  </div>;
}
