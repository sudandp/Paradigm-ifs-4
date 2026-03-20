import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { allNavLinks } from '../components/layouts/MainLayout';
import { LogOut } from 'lucide-react';
import { ProfilePlaceholder } from '../components/ui/ProfilePlaceholder';
import { isAdmin } from '../utils/auth';

const MobileHome: React.FC = () => {
    const { user, logout } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();

    if (!user) return null;

    // Robust permission lookup that handles role naming variations
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

    // Filter links based on user permissions (admins see everything)
    const availableLinks = user ? allNavLinks
        .filter(link => isAdmin(user.role) || userPermissions.includes(link.permission))
        .sort((a, b) => a.label.localeCompare(b.label))
        : [];

    const handleLogout = () => {
        navigate('/auth/logout');
    };

    return (
        <div className="min-h-[calc(100vh-180px)] flex flex-col pb-4 bg-[#041b0f]">
            {/* Header Section - No negative margin since main Header is hidden */}
            <div className="bg-[#041b0f] p-6 rounded-3xl shadow-lg -mx-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <ProfilePlaceholder photoUrl={user.photoUrl} seed={user.id} className="h-14 w-14 rounded-full border-2 border-[#22c55e]" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">Hi, {user.name.split(' ')[0]}</h1>
                            <p className="text-xs text-gray-400 uppercase tracking-wider">{user.role.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Grid - Fill remaining space */}
            <div className="flex-1 flex flex-col">
                <h2 className="text-lg font-semibold text-white mb-4 px-2">Apps & Features</h2>
                <div className="grid grid-cols-3 gap-3 px-2 flex-1 content-start">
                    {availableLinks.map((link) => (
                        <div
                            key={link.to}
                            onClick={() => navigate(link.to)}
                            className="flex flex-col items-center justify-center p-4 bg-[#041b0f] border border-[#1f3d2b] rounded-2xl active:scale-95 transition-transform duration-150 shadow-md min-h-[110px]"
                        >
                            <div className="p-3 bg-[#041b0f] rounded-full mb-2 text-[#22c55e]">
                                <link.icon className="w-7 h-7" />
                            </div>
                            <span className="text-xs text-center text-gray-300 font-medium leading-tight">{link.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Logout Button */}
            <div className="px-2 mt-6">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 p-4 bg-[#1f2937] text-white rounded-xl font-semibold active:bg-[#374151] transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Log Out</span>
                </button>
            </div>
        </div>
    );
};

export default MobileHome;
