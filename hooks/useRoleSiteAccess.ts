import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import type { Entity } from '../types';
import type { SiteResponsibilityMatrix } from '../types/siteRouting';
import { getUserRoutingScope, type UserRoutingScope } from '../services/siteRoutingScope';

export interface RoleSiteAccess {
    /** Filtered sites the logged-in user is allowed to view */
    allowedSites: Entity[];
    /** Whether the user can switch between sites (multi-site access) */
    canSelectSite: boolean;
    /** Default selected site ID ('all' for admins, specific ID for single-site users) */
    defaultSiteId: string;
    /** Loading state while sites are being resolved */
    isLoading: boolean;
    /** Scoped routing details and cross-functional team info */
    routingScope: UserRoutingScope;
}

/**
 * Determines which sites the current user is authorized to view based on the
 * centralized Site Responsibility Matrix and their allocated role.
 *
 * - Global admins (admin, super_admin, developer, management) → all 202+ sites
 * - Allocated users (Ops Manager, HR Lead, Accounts Lead, Site Manager, Field Officer)
 *   → only their allocated sites from the Site Responsibility Matrix
 */
export function useRoleSiteAccess(): RoleSiteAccess {
    const { user } = useAuthStore();
    const [allSites, setAllSites] = useState<Entity[]>([]);
    const [matrixList, setMatrixList] = useState<SiteResponsibilityMatrix[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const role = user?.role || '';
    const isManagerRole = ['operation_manager', 'management', 'reporting_manager'].includes(role);
    const isSiteManagerRole = role === 'site_manager';

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const [sites, matrixData] = await Promise.all([
                    api.getEntities(),
                    api.getSiteResponsibilityMatrix().catch(() => [] as SiteResponsibilityMatrix[])
                ]);
                if (cancelled) return;
                setAllSites(sites);
                setMatrixList(matrixData || []);

                // For manager roles, also load users to find reporting team sites
                if (isManagerRole && user?.id) {
                    const users = await api.getUsers({ fetchAll: true }).catch(() => []);
                    if (cancelled) return;
                    setAllUsers(users);
                }
            } catch (err) {
                console.error('[useRoleSiteAccess] Failed to load sites and matrix:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [user?.id, role, isManagerRole]);

    const routingScope = useMemo(() => getUserRoutingScope(user, matrixList), [user, matrixList]);

    const { allowedSites, canSelectSite, defaultSiteId } = useMemo(() => {
        if (!user) {
            return { allowedSites: [] as Entity[], canSelectSite: false, defaultSiteId: '' };
        }

        // --- Global Admins: unrestricted full access ---
        if (routingScope.isGlobalAdmin) {
            return {
                allowedSites: allSites,
                canSelectSite: true,
                defaultSiteId: 'all',
            };
        }

        // Parse user's own profile-allocated site IDs
        const ownSiteIds = new Set(
            (user.organizationId || '').split(',').map(s => s.trim()).filter(Boolean)
        );

        // Manager roles: collect sites from direct reporting staff
        const teamSiteIds = new Set<string>();
        if (isManagerRole) {
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
        }

        // Filter all entities against matrix routing scope + explicit ID allocations
        const filtered = allSites.filter(s => {
            if (routingScope.isSitePermitted(s.name)) return true;
            if (ownSiteIds.has(s.id) || teamSiteIds.has(s.id)) return true;

            // Lookup against matrix
            const mMatch = matrixList.find(m => m.id === s.id || m.siteId === s.id || m.organizationId === s.id);
            if (mMatch && routingScope.isSitePermitted(mMatch.siteName, mMatch.billingCompany)) return true;

            return false;
        });

        // If entities table has not synced with all matrix sites, generate entities for permitted sites
        let effectiveSites = filtered;
        if (effectiveSites.length === 0 && routingScope.permittedSiteList.length > 0) {
            effectiveSites = routingScope.permittedSiteList.map(sName => {
                const existing = allSites.find(s => s.name.toLowerCase().trim() === sName.toLowerCase().trim());
                if (existing) return existing;
                return {
                    id: `mat_${sName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                    name: sName,
                    code: sName.slice(0, 4).toUpperCase(),
                    status: 'completed' as const,
                    companyId: 'comp_1',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                } as unknown as Entity;
            });
        }

        // Site Manager role: restricted to single own site if assigned
        if (isSiteManagerRole && effectiveSites.length === 1) {
            return {
                allowedSites: effectiveSites,
                canSelectSite: false,
                defaultSiteId: effectiveSites[0].id,
            };
        }

        return {
            allowedSites: effectiveSites,
            canSelectSite: effectiveSites.length > 1,
            defaultSiteId: effectiveSites.length > 1 ? 'all' : (effectiveSites[0]?.id || ''),
        };
    }, [user, allSites, matrixList, allUsers, routingScope, isManagerRole, isSiteManagerRole]);

    return { allowedSites, canSelectSite, defaultSiteId, isLoading, routingScope };
}
