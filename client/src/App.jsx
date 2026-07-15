/**
 * App.jsx — root component.
 * Listens for the auth:session-expired custom event emitted by the axios
 * interceptor and clears Redux credentials so the user is redirected to login.
 */
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import store from './store';
import router from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { clearCredentials } from './features/auth/store/auth.slice';

function SessionWatcher() {
  useEffect(() => {
    function handleExpired() {
      store.dispatch(clearCredentials());
    }
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);
  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <SessionWatcher />
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ThemeProvider>
    </Provider>
  );
}
