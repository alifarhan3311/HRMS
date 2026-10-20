/**
 * Keeps signed-in users out of guest-only pages such as /login.
 * The server's HttpOnly-cookie session is the source of truth; Redux state
 * alone is never accepted as proof of authentication.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCredentials, setCredentials } from '../../features/auth/store/auth.slice';
import { useGetMeQuery } from '../../features/auth/api/auth.api';

export default function GuestRoute({ children }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { data, error, isLoading, isFetching, isError, refetch } = useGetMeQuery(undefined, {
    // Revalidate on every visit so logout/revocation in another tab is honored.
    refetchOnMountOrArgChange: true,
  });

  const isAuthenticationError = error?.status === 401 || error?.status === 403;
  const serverMessage = error?.data?.error?.message;
  const isRateLimited = error?.status === 429;

  useEffect(() => {
    if (data?.data?.user) dispatch(setCredentials(data.data.user));
  }, [data, dispatch]);

  useEffect(() => {
    if (isAuthenticationError) dispatch(clearCredentials());
  }, [dispatch, isAuthenticationError]);

  if (isLoading || isFetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (isError && !isAuthenticationError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Unable to verify your session</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRateLimited
              ? 'Too many requests were received. Please wait briefly and try again.'
              : serverMessage || 'The server could not verify your session. Please try again.'}
          </p>
          <button
            type="button"
            onClick={refetch}
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // A failed revalidation can leave RTK Query's previous successful payload
  // available as `data`; an explicit auth failure must win over that cache.
  if (isAuthenticationError) return children;

  if (data?.data?.user) {
    const requestedPath = location.state?.from?.pathname;
    const destination = requestedPath?.startsWith('/') && requestedPath !== '/login'
      ? requestedPath
      : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
}
