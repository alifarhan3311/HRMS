/**
 * features/auth/pages/LoginPage.jsx
 */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Mail, Lock, ArrowRight } from 'lucide-react';
import { useLoginMutation } from '../api/auth.api';
import { setCredentials } from '../store/auth.slice';
import Button from '../../../components/ui/Button';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await login(form).unwrap();
      dispatch(setCredentials(response.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err?.data || err?.message || 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="glass-card p-8 shadow-glow">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your HR Management System
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" className="group w-full gap-2" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
              {!isLoading && (
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Enterprise HRMS · Secure · Role-based Access
        </p>
      </motion.div>
    </div>
  );
}
