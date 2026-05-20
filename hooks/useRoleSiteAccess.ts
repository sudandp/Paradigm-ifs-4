import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { isAdmin } from '../utils/auth';
import type { Entity } from '../types';

interface RoleSiteAccess {
    /** Filtered sites the logged-in user is allowed to view */
    allowedSites: Entity[];
    /** Whether the user can switch between sites (multi-site access) */
    canSelectSite: boolean;
    /** Default selected site ID ('all' for admins, specific ID for single-site users) */
    defaultSiteId: string;
    /** Loading state while sites are being resolved */
    isLoading: boolean;
}

/**
 * Determines which sites the current user is authorized to view based on their role.
 *
 * - admin / super_admin / hr → all sites
 * - operation_manager → sites from own organizationId + sites from direct reports
 * - site_manager → only their own organizationId site(s)
 * - management / reporting_manager → sites from own organizationId + direct reports
 * - Other roles → own organizationId only
 */
export function useRoleSiteAccess(): RoleSiteAccess {
    const { user } = useAuthStore();
    const [allSites, setAllSites] = useState<Entity[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const role = user?.role || '';
    const isSuperRole = isAdmin(role) || role === 'hr';
    const isManagerRole = ['operation_manager', 'management', 'reporting_manager'].includes(role);
    const isSiteManagerRole = role === 'site_manager';

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const sites = await api.getEntities();
                if (cancelled) return;
                setAllSites(sites);

                // For manager roles, also load users to find team sites
                if (isManagerRole && user?.id) {
                    const users = await api.getUsers({ fetchAll: true });
                    if (cancelled) return;
                    setAllUsers(users);
                }
            } catch (err) {
                console.error('[useRoleSiteAccess] Failed to load sites:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [user?.id, role]);

    const { allowedSites, canSelectSite, defaultSiteId } = useMemo(() => {
        if (!user || allSites.length === 0) {
            return { allowedSites: [] as Entity[], canSelectSite: false, defaultSiteId: '' };
        }

        // --- Admin / HR: full access ---
        if (isSuperRole) {
            return {
                allowedSites: allSites,
                canSelectSite: true,
                defaultSiteId: 'all',
            };
        }

        // Parse the user's own allocated site IDs
        const ownSiteIds = new Set(
            (user.organizationId || '').split(',').map(s => s.trim()).filter(Boolean)
        );

        // --- Manager roles: own sites + team sites ---
        if (isManagerRole) {
            const teamSiteIds = new Set<string>();
            // Find all users who report to the current user
            allUsers.forEach((u: any) => {
                const reportsToMe =
                    u.reportingManagerId === user.id ||
                    u.reportingManager2Id === user.id ||
                    u.reportingManager3Id === user.id;
                if (reportsToMe && u.organizationId) {
                    u.organizationId.split(',').map((s: string) => s.trim()).filter(Boolean)
                        .forEach((id: string) => teamSiteIds.add(id));
                }
            });

            // Merge own + team sites
            const mergedIds = new Set([...ownSiteIds, ...teamSiteIds]);
            const filtered = allSites.filter(s => mergedIds.has(s.id));

            return {
                allowedSites: filtered,
                canSelectSite: filtered.length > 1,
                defaultSiteId: filtered.length > 1 ? 'all' : (filtered[0]?.id || ''),
            };
        }

        // --- Site Manager: own site only, no selector ---
        if (isSiteManagerRole) {
            const filtered = allSites.filter(s => ownSiteIds.has(s.id));
            return {
                allowedSites: filtered,
                canSelectSite: false,
                defaultSiteId: filtered[0]?.id || '',
            };
        }

        // --- Default: own org sites ---
        const filtered = allSites.filter(s => ownSiteIds.has(s.id));
        return {
            allowedSites: filtered,
            canSelectSite: filtered.length > 1,
            defaultSiteId: filtered.length === 1 ? filtered[0].id : (filtered.length > 1 ? 'all' : ''),
        };
    }, [user, allSites, allUsers, isSuperRole, isManagerRole, isSiteManagerRole]);

    return { allowedSites, canSelectSite, defaultSiteId, isLoading };
}
