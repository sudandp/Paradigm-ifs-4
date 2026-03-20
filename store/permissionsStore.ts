


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole, Permission, Role } from '../types';
import { api } from '../services/api';

interface PermissionsState {
  permissions: Record<UserRole, Permission[]>;
  setRolePermissions: (role: UserRole, permissions: Permission[]) => void;
  initRoles: (roles: Role[]) => void;
  addRolePermissionEntry: (role: Role) => void;
  removeRolePermissionEntry: (roleId: string) => void;
  renameRolePermissionEntry: (oldId: string, newId: string) => void;
}

const defaultPermissions: Record<UserRole, Permission[]> = {
  // Unverified users have no permissions - they should be redirected to pending approval page
  unverified: [],
  admin: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management',
    'view_developer_settings', 'view_operations_dashboard', 'view_site_dashboard',
    'create_enrollment', 'manage_roles_and_permissions', 'manage_attendance_rules',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests',
    'manage_approval_workflow', 'download_attendance_report', 'manage_tasks',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing',
    'view_field_staff_tracking', 'manage_modules', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'manage_biometric_devices',
    'manage_geo_locations', 'view_my_locations', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  hr: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management',
    'manage_attendance_rules', 'view_all_attendance', 'view_own_attendance',
    'apply_for_leave', 'manage_leave_requests', 'download_attendance_report',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing', 'access_support_desk',
    'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  finance: [
    'view_invoice_summary',
    'view_verification_costing',
    'view_own_attendance',
    'apply_for_leave',
    'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  developer: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management',
    'view_developer_settings', 'view_operations_dashboard', 'view_site_dashboard',
    'create_enrollment', 'manage_roles_and_permissions', 'manage_attendance_rules',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests',
    'manage_approval_workflow', 'download_attendance_report', 'manage_tasks',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing',
    'view_field_staff_tracking', 'manage_modules', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'manage_biometric_devices',
    'manage_geo_locations', 'view_my_locations', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  operation_manager: [
    'view_operations_dashboard', 'view_all_attendance', 'view_own_attendance',
    'apply_for_leave', 'manage_leave_requests', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'view_field_staff_tracking',
    'manage_geo_locations', 'view_my_locations', 'view_profile',
    'download_attendance_report',
    'view_mobile_nav_home', 'view_mobile_nav_profile'
  ],
  site_manager: ['view_site_dashboard', 'create_enrollment', 'view_my_team', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests', 'access_support_desk', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  field_staff: ['create_enrollment', 'view_own_attendance', 'apply_for_leave', 'access_support_desk', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  management: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management',
    'view_developer_settings', 'view_operations_dashboard', 'view_site_dashboard',
    'create_enrollment', 'manage_roles_and_permissions', 'manage_attendance_rules',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests',
    'manage_approval_workflow', 'download_attendance_report', 'manage_tasks',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing',
    'view_field_staff_tracking', 'manage_modules', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'manage_biometric_devices',
    'manage_geo_locations', 'view_my_locations', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  hr_ops: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management',
    'view_operations_dashboard', 'view_site_dashboard', 'create_enrollment',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests',
    'download_attendance_report', 'manage_tasks', 'manage_policies', 'manage_insurance',
    'manage_enrollment_rules', 'manage_uniforms', 'view_invoice_summary',
    'view_verification_costing', 'view_field_staff_tracking', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'manage_geo_locations', 'view_my_locations', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  finance_manager: [
    'view_all_submissions', 'view_entity_management', 'view_invoice_summary',
    'view_verification_costing', 'view_own_attendance', 'apply_for_leave', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
  bd: [
    'access_support_desk', 'view_profile',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
  ],
};

export const usePermissionsStore = create(
  persist<PermissionsState>(
    (set, get) => ({
      permissions: defaultPermissions,

      initRoles: (roles) => {
        if (!roles) return;
        const newPermissions = { ...get().permissions };
        let hasChanged = false;

        roles.forEach(role => {
          // If the role object from DB has permissions, merge them with defaults.
          // This ensures that even if DB has empty array, base permissions remain.
          if (role.permissions) {
            // Filter out empty arrays or empty strings
            const validPermissions = Array.isArray(role.permissions) 
                ? role.permissions.filter(p => !!p)
                : [];
            
            // If valid permissions found, use them, but always ensure view_profile is there if it's a valid role
            // This is a safety measure to prevent lockout.
            const basePermissions: Permission[] = ['view_profile', 'view_own_attendance', 'view_mobile_nav_home', 'view_mobile_nav_profile'];
            const mergedPermissions = [...new Set([...basePermissions, ...validPermissions])];
            const cleanId = role.id.toLowerCase();
            newPermissions[cleanId] = mergedPermissions;
            hasChanged = true;
          } else {
            const cleanId = role.id.toLowerCase();
            if (cleanId !== 'unverified' && !newPermissions[cleanId]) {
              newPermissions[cleanId] = ['view_profile', 'view_own_attendance', 'view_mobile_nav_home', 'view_mobile_nav_profile'];
              hasChanged = true;
            }
          }
        });

        if (hasChanged) {
          set({ permissions: newPermissions });
        }
      },

      addRolePermissionEntry: (role) => {
        set((state) => ({
          permissions: {
            ...state.permissions,
            [role.id]: [],
          },
        }));
      },

      removeRolePermissionEntry: (roleId) => {
        set((state) => {
          const newPermissions = { ...state.permissions };
          delete newPermissions[roleId];
          return { permissions: newPermissions };
        });
      },

      renameRolePermissionEntry: (oldId, newId) => {
        set((state) => {
          const newPermissions = { ...state.permissions };
          if (newPermissions[oldId]) {
            newPermissions[newId] = newPermissions[oldId];
            delete newPermissions[oldId];
          }
          return { permissions: newPermissions };
        });
      },

      setRolePermissions: (role, newPermissions) => {
        set((state) => ({
          permissions: {
            ...state.permissions,
            [role]: newPermissions,
          },
        }));
      },
    }),
    {
      name: 'paradigm_app_permissions_v7',
      storage: createJSONStorage(() => localStorage),
    }
  )
);