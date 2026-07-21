import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function RoleRoute({ allowedRoles, children }) {
  const role = useSelector((state) => state.auth.user?.role);
  if (!role || !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}
