/**
 * features/dashboard/pages/DashboardListPage.jsx
 * Role-based dashboard — renders Employee, HR, or Admin view per JWT role.
 */
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { useGetDashboardSummaryQuery } from '../api/dashboard.api';
import { DashboardSkeleton } from '../../../components/ui/Skeleton';
import EmployeeDashboard from '../components/EmployeeDashboard';
import HRDashboard from '../components/HRDashboard';
import AdminDashboard from '../components/AdminDashboard';
import { isAdminRole, isHRRole } from '../../../config/navigation';

export default function DashboardListPage() {
  const { user } = useSelector((state) => state.auth);
  const { data, isLoading, isError, error } = useGetDashboardSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    const errorMessage =
      error?.data?.error?.message
      || error?.data?.message
      || error?.message
      || 'Please try refreshing the page.';

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <p className="text-lg font-medium text-destructive">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground mt-1">
          {typeof errorMessage === 'string'
            ? errorMessage
            : 'Please try refreshing the page.'}
        </p>
      </motion.div>
    );
  }

  const dashboard = data?.data;

  if (!dashboard) {
    return <p className="text-muted-foreground">No dashboard data available.</p>;
  }

  if (isAdminRole(user?.role) || dashboard.role === 'admin') {
    return <AdminDashboard data={dashboard} />;
  }

  if (isHRRole(user?.role) && !isAdminRole(user?.role)) {
    return <HRDashboard data={dashboard} />;
  }

  if (dashboard.role === 'manager') {
    return (
      <div className="space-y-8">
        <EmployeeDashboard data={dashboard} />
        {dashboard.teamOverview && (
          <HRDashboard data={{ ...dashboard, employeeStatistics: dashboard.teamOverview }} />
        )}
      </div>
    );
  }

  return <EmployeeDashboard data={dashboard} />;
}
