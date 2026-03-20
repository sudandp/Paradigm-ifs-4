import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type { Permission } from '../../types';

import { isAdmin } from '../../utils/auth';

interface ProtectedRouteProps {
  requiredPermission: Permission;
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredPermission, children }) => {
  const { user, isInitialized } = useAuthStore();
  // Subscribe to the entire permissions object for reactivity.
  // When this object changes in the store, this component will re-render.
  const { permissions } = usePermissionsStore();

  if (!isInitialized) {
    // Wait for the session check to complete.
    return null;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const getPermissions = () => {
    if (!user || !permissions) return [];
    const roleId = user.roleId?.toLowerCase() || '';
    const roleName = user.role?.toLowerCase() || '';
    const roleNameUnderscore = roleName.replace(/\s+/g, '_');

    // Get permissions from store based on various possible keys
    const foundPermissions = permissions[roleId] || 
           permissions[roleName] || 
           permissions[roleNameUnderscore] || 
           permissions[user.role] || 
           [];

    // ROBUSTNESS FALLBACK: 
    // If we are authenticated but have no permissions loaded yet, 
    // provide essential base permissions to avoid premature lockout.
    if (foundPermissions.length === 0 && user.id && user.role !== 'unverified') {
        const basePermissions: Permission[] = ['view_profile', 'view_own_attendance', 'view_mobile_nav_home', 'view_mobile_nav_profile'];
        return basePermissions;
    }

    return foundPermissions;
  };

  const userPermissions = getPermissions();
  
  // Base permissions that are ALWAYS allowed for any verified user
  const isEssentialPermission = requiredPermission === 'view_profile' || 
                               requiredPermission === 'view_own_attendance';

  const isUserAdmin = isAdmin(user.role);
  const hasAccess = isUserAdmin || userPermissions.includes(requiredPermission) || (isEssentialPermission && user.role !== 'unverified');

  if (!hasAccess) {
    // DIAGNOSTIC LOGGING: Helps identify permission issues in production
    console.warn(`[ProtectedRoute] Access Denied: 
      User: ${user.email} (${user.id})
      Role: ${user.role} (ID: ${user.roleId})
      Required: ${requiredPermission}
      UserPerms: ${JSON.stringify(userPermissions)}
    `);
    
    // User does not have the required permission, redirect to a forbidden page
    return <Navigate to="/forbidden" replace />;
  }

  // If `children` are provided, render them. Otherwise, render the outlet for nested routes.
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;