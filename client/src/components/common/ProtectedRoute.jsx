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
  const { data, isLoading, isFetching, isError } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (data?.data?.user) dispatch(setCredentials(data.data.user));
  }, [data, dispatch]);

  useEffect(() => {
    if (isError) dispatch(clearCredentials());
  }, [dispatch, isError]);

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

  if (isError) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!data?.data?.user) return null;

  return children;
}
