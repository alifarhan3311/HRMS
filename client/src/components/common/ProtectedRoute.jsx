/**
 * components/common/ProtectedRoute.jsx
 * Guards authenticated routes. On first render after a hard refresh,
 * the Redux auth state is empty (not persisted to localStorage), so we
 * call GET /auth/me once to re-hydrate from the HttpOnly cookie session.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials } from '../../features/auth/store/auth.slice';
import { useGetMeQuery } from '../../features/auth/api/auth.api';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useSelector(s => s.auth);
  const location = useLocation();
  const dispatch = useDispatch();

  // If Redux state is empty, try to rehydrate from cookie session
  const { data, isLoading, isError } = useGetMeQuery(undefined, {
    skip: isAuthenticated, // already authenticated — skip
  });

  useEffect(() => {
    if (data?.data) {
      dispatch(setCredentials(data.data));
    }
  }, [data, dispatch]);

  // While checking the session, show a minimal loader
  if (!isAuthenticated && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // No valid session found
  if (!isAuthenticated && isError) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Still waiting for the /me call before deciding
  if (!isAuthenticated && !data) {
    return null;
  }

  return children;
}
