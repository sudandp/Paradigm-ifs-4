import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarCheck, ListTodo, User } from 'lucide-react';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';

const BottomNav: React.FC = () => {
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();

    if (!user) return null;

    const getPermissions = () => {
        if (!user || !permissions) return [];
        const roleId = user.roleId?.toLowerCase() || '';
        const roleName = user.role?.toLowerCase() || '';
        const roleNameUnderscore = roleName.replace(/\s+/g, '_');

        return permissions[roleId] || 
               permissions[roleName] || 
               permissions[roleNameUnderscore] || 
               permissions[user.role] || 
               [];
    };

    const userPermissions = getPermissions();

    // Define mobile navigation items based on permissions
    const navItems = [
        {
            to: '/mobile-home',
            label: 'Home',
            icon: Home,
            show: userPermissions.includes('view_mobile_nav_home' as any)
        },
        {
            to: '/attendance/dashboard',
            label: 'Attendance',
            icon: CalendarCheck,
            show: userPermissions.includes('view_mobile_nav_attendance' as any)
        },
        {
            to: '/tasks',
            label: 'Tasks',
            icon: ListTodo,
            show: userPermissions.includes('view_mobile_nav_tasks' as any)
        },
        {
            to: '/profile',
            label: 'Profile',
            icon: User,
            show: userPermissions.includes('view_mobile_nav_profile' as any)
        }
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 bg-[#041b0f] border-t border-[#1f3d2b] z-40"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex justify-around items-center h-16">
                {navItems.filter(item => item.show).map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive ? 'text-[#22c55e]' : 'text-gray-400'
                            }`
                        }
                    >
                        <item.icon className="w-6 h-6" />
                        <span className="text-xs mt-1">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default BottomNav;
