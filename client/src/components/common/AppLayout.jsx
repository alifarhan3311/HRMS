/**
 * components/common/AppLayout.jsx
 */
import { useEffect, useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../ui/ToastContainer';
import RealtimeNotifications from './RealtimeNotifications';

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!logoutLoading) return undefined;
    document.activeElement?.blur?.();
    const freezeKeyboard = event => event.preventDefault();
    document.addEventListener('keydown', freezeKeyboard, true);
    return () => document.removeEventListener('keydown', freezeKeyboard, true);
  }, [logoutLoading]);

  return (
    <div className="flex h-screen overflow-hidden bg-background" aria-busy={logoutLoading}>
      {logoutLoading && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[900] flex cursor-wait items-center justify-center bg-background/90 backdrop-blur-md"
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="flex min-w-64 flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="font-semibold">Logging out...</p>
            <p className="text-sm text-muted-foreground">Please wait while your session closes</p>
          </div>
        </div>
      )}
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setMobileNavOpen(true)}
          onLogoutLoadingChange={setLogoutLoading}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
      <RealtimeNotifications />
    </div>
  );
}
