import { useState } from 'react';
import { Activity, Clock3, Globe2, Laptop, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone, Tablet, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { toast } from '../../../utils/toast';
import { useListAuthSessionsQuery, useRevokeAuthSessionMutation } from '../api/auth.api';

function browserSystem(userAgent = '') {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes('edg/') ? 'Microsoft Edge'
    : ua.includes('opr/') || ua.includes('opera') ? 'Opera'
      : ua.includes('firefox/') ? 'Mozilla Firefox'
        : ua.includes('chrome/') ? 'Google Chrome'
          : ua.includes('safari/') ? 'Safari' : 'Unknown browser';
  const system = ua.includes('windows') ? 'Windows'
    : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios') ? 'iOS'
      : ua.includes('android') ? 'Android'
        : ua.includes('mac os') || ua.includes('macintosh') ? 'macOS'
          : ua.includes('linux') ? 'Linux' : 'Unknown system';
  const device = /ipad|tablet/.test(ua) ? 'Tablet'
    : /mobile|iphone|android/.test(ua) ? 'Mobile device' : 'Computer';
  return { browser, system, device };
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function SessionsPage() {
  const { data: response, isLoading, isFetching, error, refetch } = useListAuthSessionsQuery();
  const [revokeSession, { isLoading: isRevoking }] = useRevokeAuthSessionMutation();
  const [target, setTarget] = useState(null);
  const payload = response?.data || {};
  const sessions = payload.items || [];
  const currentSessionId = String(payload.currentSessionId || '');

  const confirmSignOut = async () => {
    if (!target) return;
    try {
      await revokeSession(target._id).unwrap();
      toast.success('Your selected device has been signed out.');
      setTarget(null);
    } catch (requestError) {
      toast.error(requestError?.data?.error?.message || 'Could not sign out this device.');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Security Center</p>
            <h1 className="text-3xl font-bold">Devices &amp; Sessions</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review devices signed in to your account, including browser, operating system and IP. Only your own sessions appear here.
            </p>
          </div>
          <Button variant="outline" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}</span>
          <span>Only HR and Admin can access their own device sessions.</span>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-36 w-full rounded-2xl" />)}</div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load sessions. Please refresh or check your access.
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <MonitorSmartphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-semibold">No active sessions found</h2>
          <p className="mt-1 text-sm text-muted-foreground">New logins will appear here with their browser, system and IP address.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const employee = session.employeeId || {};
            const { browser, system, device } = browserSystem(session.userAgent);
            const isCurrent = String(session._id) === currentSessionId;
            const DeviceIcon = device === 'Mobile device' ? Smartphone : device === 'Tablet' ? Tablet : Laptop;
            return (
              <article key={session._id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary"><DeviceIcon className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{employee.fullName || 'Unknown employee'}</h2>
                        {isCurrent && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">This device</span>}
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">{employee.role?.replaceAll('_', ' ') || 'user'}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{employee.email || employee.employeeCode || '—'}{employee.department ? ` · ${employee.department}` : ''}</p>
                      <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="flex items-start gap-2"><DeviceIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{browser}<span className="block text-muted-foreground">{system} · {device}</span></span></div>
                        <div className="flex items-start gap-2"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{session.location || 'Location unavailable'}<span className="block text-muted-foreground">{session.ipAddress || 'IP unavailable'} · approximate IP location</span></span></div>
                        <div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{dateTime(session.createdAt)}<span className="block text-muted-foreground">Signed in</span></span></div>
                        <div className="flex items-start gap-2"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{dateTime(session.lastActivityAt || session.createdAt)}<span className="block text-muted-foreground">Last HRMS activity</span></span></div>
                      </div>
                    </div>
                  </div>
                  <Button variant="danger" size="sm" disabled={isCurrent} onClick={() => setTarget(session)} title={isCurrent ? 'You cannot sign out the device you are currently using.' : 'Sign out this device'}>
                    <X className="h-4 w-4" /> {isCurrent ? 'Current device' : 'Sign out'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(target)}
        onCancel={() => setTarget(null)}
        onConfirm={confirmSignOut}
        isLoading={isRevoking}
        title="Sign out this device?"
        message={target ? 'Your account will be signed out from the selected device only. Your current device and other accounts will not be affected.' : ''}
        confirmLabel="Sign out device"
      />
    </div>
  );
}
