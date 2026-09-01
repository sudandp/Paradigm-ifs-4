import { api } from '../services/api';
import type { SiteResponsibilityMatrix } from '../types/siteRouting';

let matrixCache: SiteResponsibilityMatrix[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch and cache the full Site Responsibility Matrix
 */
export async function getCachedSiteMatrix(forceRefresh = false): Promise<SiteResponsibilityMatrix[]> {
  const now = Date.now();
  if (!forceRefresh && matrixCache && now - lastFetchTime < CACHE_TTL_MS) {
    return matrixCache;
  }
  try {
    matrixCache = await api.getSiteResponsibilityMatrix();
    lastFetchTime = now;
    return matrixCache;
  } catch (err) {
    console.error('[SiteRouting] Failed to fetch matrix:', err);
    return matrixCache || [];
  }
}

/**
 * Resolve the operational triad (Ops, HR, Accounts) for any site
 */
export async function resolveSiteIncharges(siteNameOrId: string): Promise<SiteResponsibilityMatrix | null> {
  if (!siteNameOrId) return null;
  const list = await getCachedSiteMatrix();
  const search = siteNameOrId.trim().toLowerCase();

  return (
    list.find(
      (m) =>
        m.id === siteNameOrId ||
        m.siteId === siteNameOrId ||
        m.siteName.toLowerCase() === search ||
        (m.billingLegalName && m.billingLegalName.toLowerCase() === search) ||
        m.siteName.toLowerCase().includes(search) ||
        search.includes(m.siteName.toLowerCase())
    ) || null
  );
}

/**
 * Automatically resolve task / ticket assignee based on site & category
 * e.g., Nikoo Homes + Operations -> Isaac
 *       Nikoo Homes + HR / Uniform -> Kavya
 *       Nikoo Homes + Finance -> Arpita
 */
export async function resolveTaskAssignee(
  siteName: string,
  category: 'operations' | 'hr' | 'finance' | 'maintenance' | 'general'
): Promise<{ name: string; userId?: string | null; role: string } | null> {
  const site = await resolveSiteIncharges(siteName);
  if (!site) return null;

  switch (category) {
    case 'operations':
    case 'maintenance':
      return {
        name: site.opsManagerName,
        userId: site.opsManagerId,
        role: 'Operations Lead'
      };
    case 'hr':
      return {
        name: site.hrInchargeName,
        userId: site.hrInchargeId,
        role: 'HR Incharge'
      };
    case 'finance':
      return {
        name: site.accountsInchargeName,
        userId: site.accountsInchargeId,
        role: 'Accounts Incharge'
      };
    default:
      return {
        name: site.opsManagerName,
        userId: site.opsManagerId,
        role: 'Operations Lead'
      };
  }
}

/**
 * Resolve notification / email recipients for automated reports
 */
export async function resolveReportRecipients(
  siteName: string,
  reportType: 'daily_attendance' | 'monthly_invoice' | 'field_audit' | 'missed_punch'
): Promise<Array<{ role: string; name: string; userId?: string | null }>> {
  const site = await resolveSiteIncharges(siteName);
  if (!site) return [];

  const recipients: Array<{ role: string; name: string; userId?: string | null }> = [];

  if (reportType === 'daily_attendance' || reportType === 'missed_punch') {
    recipients.push({ role: 'Operations Lead', name: site.opsManagerName, userId: site.opsManagerId });
    recipients.push({ role: 'HR Incharge', name: site.hrInchargeName, userId: site.hrInchargeId });
  } else if (reportType === 'monthly_invoice') {
    recipients.push({ role: 'Accounts Lead', name: site.accountsInchargeName, userId: site.accountsInchargeId });
  } else if (reportType === 'field_audit') {
    recipients.push({ role: 'Operations Lead', name: site.opsManagerName, userId: site.opsManagerId });
  }

  return recipients;
}
