/**
 * config/navigation.js
 * Role-based navigation — every menu item maps to a path and role list.
 * comingSoon = true shows the item as disabled until the module is live.
 */
import {
  LayoutDashboard, Users, Clock, CalendarDays, Wallet,
  Receipt, FolderKanban, Settings, FileText, UserPlus,
  GraduationCap, Package, BarChart3, MessageSquare,
  TrendingUp, Bell, Building2, Shield,
} from 'lucide-react';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN:       'admin',
  HR:          'hr',
  MANAGER:     'manager',
  TEAM_LEAD:   'team_lead',
  EMPLOYEE:    'employee',
};

// Grouped navigation — groups keep the sidebar organised at scale
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      {
        id: 'dashboard', label: 'Dashboard', path: '/dashboard',
        icon: LayoutDashboard, roles: 'all',
      },
      {
        id: 'notifications', label: 'Notifications', path: '/notifications',
        icon: Bell, roles: 'all',
      },
    ],
  },
  {
    label: 'Workforce',
    items: [
      {
        id: 'employees', label: 'Employees', path: '/employees',
        icon: Users, roles: ['team_lead', 'manager', 'hr', 'super_admin'],
      },
      {
        id: 'attendance', label: 'Attendance', path: '/attendance',
        icon: Clock, roles: 'all',
      },
      {
        id: 'leaves', label: 'Leaves', path: '/leaves',
        icon: CalendarDays, roles: 'all',
      },
    ],
  },
  {
    label: 'Payroll & Expenses',
    items: [
      {
        id: 'payroll', label: 'Payroll', path: '/payroll',
        icon: Wallet,
        roles: ['employee', 'team_lead', 'manager', 'hr', 'admin', 'super_admin'],
      },
      {
        id: 'expenses', label: 'Expenses', path: '/expenses',
        icon: Receipt,
        roles: ['employee', 'manager', 'admin', 'super_admin'],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        id: 'projects', label: 'Projects', path: '/projects',
        icon: FolderKanban,
        roles: ['employee', 'team_lead', 'manager', 'admin', 'super_admin'],
      },
      {
        id: 'recruitment', label: 'Recruitment', path: '/recruitment',
        icon: UserPlus, roles: ['hr', 'super_admin'], comingSoon: true,
      },
      {
        id: 'training', label: 'Training', path: '/training',
        icon: GraduationCap, roles: ['hr', 'super_admin'], comingSoon: true,
      },
      {
        id: 'assets', label: 'Assets', path: '/assets',
        icon: Package, roles: ['hr', 'super_admin'], comingSoon: true,
      },
      {
        id: 'sales', label: 'Sales', path: '/sales',
        icon: TrendingUp, roles: ['team_lead', 'manager', 'admin', 'super_admin'], comingSoon: true,
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        id: 'reports', label: 'Reports', path: '/reports',
        icon: BarChart3, roles: ['hr', 'admin', 'super_admin'],
      },
      {
        id: 'engagement', label: 'Engagement', path: '/engagement',
        icon: MessageSquare, roles: 'all', comingSoon: true,
      },
      {
        id: 'documents', label: 'Documents', path: '/documents',
        icon: FileText, roles: 'all', comingSoon: true,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        id: 'settings', label: 'Settings', path: '/settings',
        icon: Settings, roles: ['hr', 'super_admin'],
      },
    ],
  },
];

// Flat list derived from groups — used by sidebar and permission checks
export const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

export function getNavForRole(role) {
  return ALL_NAV.filter(item => {
    if (item.roles === 'all') return true;
    return item.roles.includes(role);
  });
}

export function getNavGroupsForRole(role) {
  return NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.roles === 'all') return true;
      return item.roles.includes(role);
    }),
  })).filter(group => group.items.length > 0);
}

export function getRoleLabel(role) {
  const labels = {
    super_admin: 'Super Admin', admin: 'Admin', hr: 'HR',
    manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee',
  };
  return labels[role] || role;
}

export function isAdminRole(role)  { return ['admin', 'super_admin'].includes(role); }
export function isHRRole(role)     { return ['hr', 'super_admin'].includes(role); }
export function isManagerRole(role){ return ['manager', 'team_lead', 'super_admin', 'hr'].includes(role); }
