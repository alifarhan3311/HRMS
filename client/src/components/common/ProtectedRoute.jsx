/**
 * Guards authenticated routes by validating the HttpOnly cookie session.
 * Redux user state improves rendering, but is never treated as proof that a
 * browser session is still valid.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  clearCredentials,
  setCredentials,
} from '../../features/auth/store/auth.slice';
import { useGetMeQuery } from '../../features/auth/api/auth.api';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { data, error, isLoading, isFetching, isError, refetch } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const isAuthenticationError = error?.status === 401 || error?.status === 403;

  useEffect(() => {
    if (data?.data?.user) dispatch(setCredentials(data.data.user));
  }, [data, dispatch]);

  useEffect(() => {
    // A temporary API/database 5xx must not destroy a valid browser session.
    // Only an explicit authentication/authorization response sends the user
    // back to login.
    if (isAuthenticationError) dispatch(clearCredentials());
  }, [dispatch, isAuthenticationError]);

  if (isLoading || (isFetching && !data?.data?.user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticationError) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Unable to load your session</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The server returned a temporary error. Your login session has not been cleared.
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

  if (!data?.data?.user) return null;

  return children;
}
