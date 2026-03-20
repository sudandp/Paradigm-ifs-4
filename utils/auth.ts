export const isAdmin = (role?: string | null): boolean => {
    if (!role) return false;
    const normalized = role.toLowerCase().replace(/_/g, ' ').trim();
    return normalized === 'admin' || normalized === 'super admin' || normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'developer';
};

