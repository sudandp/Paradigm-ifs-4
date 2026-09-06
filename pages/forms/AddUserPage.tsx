import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { User, UserRole, Organization, Role, BiometricDevice, OrganizationGroup, AttendanceSettings } from '../../types';
import type { SiteResponsibilityMatrix } from '../../types/siteRouting';
import { 
  getCanonicalUserName, 
  getCleanRoot, 
  normalizeHrInchargeName, 
  normalizeOpsInchargeName, 
  normalizeAccountsInchargeName 
} from '../../services/siteRoutingScope';
import { getStaffCategory } from '../../utils/attendanceCalculations';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { api } from '../../services/api';
import { UserPlus, ArrowLeft, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuthStore } from '../../store/authStore';

/** Normalize role display names to Title Case regardless of DB storage format */
const toTitleCase = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

/** Adds a given number of months to a YYYY-MM-DD date string */
const addMonthsToDateStr = (dateStr: string, months: number): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(/-/g, '/'));
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Helper to extract all matrix site entries assigned to a given user */
export const getMatrixSitesForUser = (
  user: Partial<User> | null | undefined,
  matrixList: SiteResponsibilityMatrix[]
): SiteResponsibilityMatrix[] => {
  if (!user) return [];
  const canonicalName = getCanonicalUserName(user);
  const userCleanRoot = getCleanRoot(canonicalName);
  const userEmail = (user.email || '').toLowerCase().trim();
  const userName = (user.name || '').toLowerCase().trim();
  const userId = user.id;

  return matrixList.filter(m => {
    if (!m.siteName) return false;

    // 1. Direct ID matches
    if (userId && (
      m.hrInchargeId === userId ||
      m.opsManagerId === userId ||
      m.accountsInchargeId === userId ||
      m.siteManagerId === userId ||
      m.fieldOfficerId === userId
    )) {
      return true;
    }

    // 2. Clean root matching for canonical names
    const hrRoot = getCleanRoot(m.hrInchargeName || '');
    const opsRoot = getCleanRoot(m.opsManagerName || '');
    const accRoot = getCleanRoot(m.accountsInchargeName || '');
    const smRoot = getCleanRoot(m.siteManagerName || '');
    const foRoot = getCleanRoot(m.fieldOfficerName || '');

    if (userCleanRoot && (
      hrRoot === userCleanRoot ||
      opsRoot === userCleanRoot ||
      accRoot === userCleanRoot ||
      smRoot === userCleanRoot ||
      foRoot === userCleanRoot
    )) {
      return true;
    }

    // 3. String inclusions and normalized names
    const hrNorm = normalizeHrInchargeName(m.hrInchargeName);
    const opsNorm = normalizeOpsInchargeName(m.opsManagerName);
    const accNorm = normalizeAccountsInchargeName(m.accountsInchargeName);

    if (canonicalName && (
      hrNorm.toLowerCase().includes(canonicalName.toLowerCase()) ||
      opsNorm.toLowerCase().includes(canonicalName.toLowerCase()) ||
      accNorm.toLowerCase().includes(canonicalName.toLowerCase()) ||
      (m.siteManagerName && m.siteManagerName.toLowerCase().includes(userName)) ||
      (m.fieldOfficerName && m.fieldOfficerName.toLowerCase().includes(userName))
    )) {
      return true;
    }

    return false;
  });
};

const createUserSchema = yup.object({
  id: yup.string().optional(),
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  role: yup.string<UserRole>().required('Role is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required for new users'),
  phone: yup.string().optional().nullable(),
  noSiteAssignment: yup.boolean().optional(),
  organizationId: yup.string().when(['role', 'noSiteAssignment'], {
    is: (role: any, noSiteAssignment: any) => role === 'site_manager' && !noSiteAssignment,
    then: schema => schema.required('Site manager must be assigned to a site.'),
    otherwise: schema => schema.optional(),
  }).nullable(),
  organizationName: yup.string().optional().nullable(),
  reportingManagerId: yup.string().optional().nullable(),
  photoUrl: yup.string().optional().nullable(),
  biometricId: yup.string().optional().nullable(),
  earnedLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  earnedLeaveOpeningDate: yup.string().optional().nullable(),
  sickLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  sickLeaveOpeningDate: yup.string().optional().nullable(),
  compOffOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  compOffOpeningDate: yup.string().optional().nullable(),
  floatingLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  floatingLeaveOpeningDate: yup.string().optional().nullable(),
  childCareLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  childCareLeaveOpeningDate: yup.string().optional().nullable(),
  joiningDate: yup.string().optional().nullable(),
  societyId: yup.string().optional().nullable(),
  societyName: yup.string().optional().nullable(),
  locationId: yup.string().optional().nullable(),
  location: yup.string().optional().nullable(),
  weeklyOffDays: yup.array().of(yup.number().required()).optional().nullable(),
}).defined();

const editUserSchema = yup.object({
  id: yup.string().optional(),
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  role: yup.string<UserRole>().required('Role is required'),
  phone: yup.string().optional().nullable(),
  noSiteAssignment: yup.boolean().optional(),
  organizationId: yup.string().when(['role', 'noSiteAssignment'], {
    is: (role: any, noSiteAssignment: any) => role === 'site_manager' && !noSiteAssignment,
    then: schema => schema.required('Site manager must be assigned to a site.'),
    otherwise: schema => schema.optional(),
  }).nullable(),
  organizationName: yup.string().optional().nullable(),
  reportingManagerId: yup.string().optional().nullable(),
  photoUrl: yup.string().optional().nullable(),
  biometricId: yup.string().optional().nullable(),
  earnedLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  earnedLeaveOpeningDate: yup.string().optional().nullable(),
  sickLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  sickLeaveOpeningDate: yup.string().optional().nullable(),
  compOffOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  compOffOpeningDate: yup.string().optional().nullable(),
  floatingLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  floatingLeaveOpeningDate: yup.string().optional().nullable(),
  childCareLeaveOpeningBalance: yup.number().optional().nullable().transform((value) => (isNaN(value) ? 0 : value)).default(0),
  childCareLeaveOpeningDate: yup.string().optional().nullable(),
  joiningDate: yup.string().optional().nullable(),
  societyId: yup.string().optional().nullable(),
  societyName: yup.string().optional().nullable(),
  locationId: yup.string().optional().nullable(),
  location: yup.string().optional().nullable(),
  weeklyOffDays: yup.array().of(yup.number().required()).optional().nullable(),
}).defined();

const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allDevices, setAllDevices] = useState<BiometricDevice[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [initialData, setInitialData] = useState<User | null>(null);
  const [orgStructure, setOrgStructure] = useState<OrganizationGroup[]>([]);
  const [matrixData, setMatrixData] = useState<SiteResponsibilityMatrix[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSociety, setSelectedSociety] = useState<string>('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [siteSearchTerm, setSiteSearchTerm] = useState<string>('');
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  // Auto-sync: when saving a user with an unmapped role, intercept and prompt for category
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { user: currentUser } = useAuthStore();

  const isHrOrHrOpsOrAdmin = React.useMemo(() => {
    if (!currentUser) return false;
    const roleLower = currentUser.role?.toLowerCase();
    return ['hr', 'hr_ops', 'admin', 'super_admin', 'developer'].includes(roleLower);
  }, [currentUser]);

  const schema = isEditing ? editUserSchema : createUserSchema;
  const { register, handleSubmit, formState: { errors, dirtyFields }, reset, watch, setValue } = useForm<Partial<User> & { password?: string; noSiteAssignment?: boolean }>({
    resolver: yupResolver(schema) as unknown as Resolver<Partial<User> & { password?: string; noSiteAssignment?: boolean }>,
  });

  const { minJoiningDate, maxJoiningDate } = React.useMemo(() => {
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    const minD = new Date();
    minD.setDate(today.getDate() - 20);
    const minDate = minD.toISOString().split('T')[0];
    return { minJoiningDate: minDate, maxJoiningDate: maxDate };
  }, []);

  const minDateLimit = isHrOrHrOpsOrAdmin ? undefined : minJoiningDate;

  const role = watch('role');
  const organizationId = watch('organizationId');
  const locationId = watch('locationId');
  const societyId = watch('societyId');

  useEffect(() => {
    if (locationId !== undefined && locationId !== selectedLocation) {
      setSelectedLocation(locationId || '');
    }
  }, [locationId]);

  useEffect(() => {
    if (societyId !== undefined && societyId !== selectedSociety) {
      setSelectedSociety(societyId || '');
    }
  }, [societyId]);

  useEffect(() => {
    if (role && role !== 'unverified' && role !== 'gate_only') {
      const todayStr = new Date().toISOString().split('T')[0];
      const defaultDateStr = initialData?.createdAt ? initialData.createdAt.split('T')[0] : todayStr;
      
      const currentJoiningDate = watch('joiningDate');
      const currentElDate = watch('earnedLeaveOpeningDate');
      const currentSlDate = watch('sickLeaveOpeningDate');
      const currentCoDate = watch('compOffOpeningDate');
      const currentFlDate = watch('floatingLeaveOpeningDate');
      const currentClDate = watch('childCareLeaveOpeningDate');
      
      if (!currentJoiningDate) {
        setValue('joiningDate', defaultDateStr, { shouldValidate: true, shouldDirty: true });
      }
      const activeJoiningDate = currentJoiningDate || defaultDateStr;
      if (!currentElDate) {
        setValue('earnedLeaveOpeningDate', activeJoiningDate, { shouldValidate: true, shouldDirty: true });
      }
      if (!currentSlDate) {
        setValue('sickLeaveOpeningDate', activeJoiningDate, { shouldValidate: true, shouldDirty: true });
      }
      if (!currentCoDate) {
        setValue('compOffOpeningDate', activeJoiningDate, { shouldValidate: true, shouldDirty: true });
      }
      if (!currentFlDate) {
        setValue('floatingLeaveOpeningDate', activeJoiningDate, { shouldValidate: true, shouldDirty: true });
      }
      if (!currentClDate) {
        setValue('childCareLeaveOpeningDate', activeJoiningDate, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [role, setValue, watch, initialData]);

  // Watch joiningDate and automatically sync all leave opening dates to match it
  const watchedJoiningDate = watch('joiningDate');
  useEffect(() => {
    if (watchedJoiningDate) {
      const shouldSync = !isEditing || dirtyFields.joiningDate;
      if (shouldSync) {
        if (!dirtyFields.earnedLeaveOpeningDate) {
          setValue('earnedLeaveOpeningDate', watchedJoiningDate, { shouldValidate: true });
        }
        if (!dirtyFields.sickLeaveOpeningDate) {
          setValue('sickLeaveOpeningDate', watchedJoiningDate, { shouldValidate: true });
        }
        if (!dirtyFields.compOffOpeningDate) {
          setValue('compOffOpeningDate', watchedJoiningDate, { shouldValidate: true });
        }
        if (!dirtyFields.floatingLeaveOpeningDate) {
          setValue('floatingLeaveOpeningDate', watchedJoiningDate, { shouldValidate: true });
        }
        if (!dirtyFields.childCareLeaveOpeningDate) {
          setValue('childCareLeaveOpeningDate', watchedJoiningDate, { shouldValidate: true });
        }
      }
    }
  }, [
    watchedJoiningDate, 
    setValue, 
    isEditing, 
    dirtyFields.joiningDate, 
    dirtyFields.earnedLeaveOpeningDate, 
    dirtyFields.sickLeaveOpeningDate, 
    dirtyFields.compOffOpeningDate, 
    dirtyFields.floatingLeaveOpeningDate, 
    dirtyFields.childCareLeaveOpeningDate
  ]);

  /** Helper to resolve matching entity ID for a site name */
  const resolveSiteEntityId = useCallback((
    siteName: string, 
    structure: OrganizationGroup[], 
    orgs: Organization[], 
    mRecord?: SiteResponsibilityMatrix
  ): string => {
    const rawClean = (siteName || '').toLowerCase().trim();
    const alphaClean = rawClean.replace(/[^a-z0-9]/g, '');

    // 1. Search structure companies and entities
    for (const group of structure) {
      for (const company of group.companies) {
        for (const ent of company.entities) {
          const entRaw = ent.name.toLowerCase().trim();
          const entAlpha = entRaw.replace(/[^a-z0-9]/g, '');
          if (entRaw === rawClean || entAlpha === alphaClean) {
            return ent.id;
          }
        }
      }
    }

    // 2. Search legacy organizations list
    for (const org of orgs) {
      const orgRaw = (org.shortName || (org as any).name || (org as any).fullName || '').toLowerCase().trim();
      const orgAlpha = orgRaw.replace(/[^a-z0-9]/g, '');
      if (orgRaw === rawClean || orgAlpha === alphaClean) {
        return org.id;
      }
    }

    // 3. Fallback to matrix id or synthetic entity ID
    if (mRecord?.id) return mRecord.id;
    return `ent_${rawClean.replace(/[^a-z0-9]+/g, '_')}`;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgs, fetchedRoles, fetchedDevices, structure, settings, designations, matrix] = await Promise.all([
          api.getOrganizations(),
          api.getRoles(),
          api.getBiometricDevices ? api.getBiometricDevices() : Promise.resolve([]),
          api.getOrganizationStructure(),
          api.getAttendanceSettings(),
          api.getSiteStaffDesignations(),
          api.getSiteResponsibilityMatrix().catch(() => [] as SiteResponsibilityMatrix[])
        ]);
        
        // Deduplicate fetchedRoles by displayName (in case DB has two entries for same role)
        const seenRoleNames = new Set<string>();
        const dedupedRoles = fetchedRoles.filter(r => {
          const key = (r.displayName || r.id).toLowerCase();
          if (seenRoleNames.has(key)) return false;
          seenRoleNames.add(key);
          return true;
        });

        // Merge system roles with site staff designations
        const mergedRoles: Role[] = [...dedupedRoles];
        designations.forEach(desig => {
          if (!desig.designation) return;
          const slug = desig.designation.toLowerCase().replace(/\s+/g, '_');
          const nameNorm = desig.designation.toLowerCase();
          // Deduplicate by both slug-id AND displayName (DB roles use UUID ids, not slugs)
          const alreadyExists = mergedRoles.some(r =>
            r.id === slug || (r.displayName || '').toLowerCase() === nameNorm
          );
          if (!alreadyExists) {
            mergedRoles.push({
              id: slug,
              displayName: desig.designation
            });
          }
        });

        // Normalize ALL displayNames to Title Case (DB may store them in ALL CAPS)
        mergedRoles.forEach(r => {
          if (r.displayName) r.displayName = toTitleCase(r.displayName);
        });

        // Sort roles A-Z
        const sortedRoles = mergedRoles.sort((a, b) =>
          (a.displayName || a.id).localeCompare(b.displayName || b.id)
        );

        setOrganizations(orgs);
        setRoles(sortedRoles);
        setAllDevices(fetchedDevices);
        setOrgStructure(structure);
        setAttendanceSettings(settings);
        setMatrixData(matrix);

        if (isEditing && id) {
          const users = await api.getUsers();
          const user = users.find(u => u.id === id);
          if (user) {
            setInitialData(user);

            // Collect all unique locations
            const uniqueLocations = new Set<string>();
            structure.forEach(group => {
              if (Array.isArray(group.locations)) {
                group.locations.forEach(loc => { if (loc) uniqueLocations.add(loc); });
              }
              group.companies.forEach(company => {
                if (company.location) uniqueLocations.add(company.location);
                company.entities.forEach(entity => {
                  if (entity.location) uniqueLocations.add(entity.location);
                });
              });
            });

            // Auto-resolve hierarchy for edit mode
            let targetSocietyId = user.societyId || '';
            let targetLocation = '';

            // Priority 1: Direct user.location
            if (user.location && (uniqueLocations.has(user.location) || uniqueLocations.size === 0)) {
              targetLocation = user.location;
            } else if (user.location) {
              const matched = Array.from(uniqueLocations).find(l => l.toLowerCase() === user.location!.toLowerCase());
              if (matched) targetLocation = matched;
            }

            // Priority 2: If user.locationId is a location name rather than a group ID
            if (!targetLocation && user.locationId && uniqueLocations.has(user.locationId)) {
              targetLocation = user.locationId;
            }

            // Priority 3: Resolve through company (society)
            if (!targetLocation && targetSocietyId) {
              for (const group of structure) {
                for (const company of group.companies) {
                  if (company.id === targetSocietyId && company.location) {
                    targetLocation = company.location;
                    break;
                  }
                }
                if (targetLocation) break;
              }
            }

            // Priority 4: Resolve through user.locationId if it is a group ID
            if (!targetLocation && user.locationId) {
              const matchedGroup = structure.find(g => g.id === user.locationId);
              if (matchedGroup?.locations && matchedGroup.locations.length > 0) {
                targetLocation = matchedGroup.locations[0];
              }
            }

            // Priority 5: Fallback to first available location or 'Bangalore'
            if (!targetLocation) {
              const availableLocs = Array.from(uniqueLocations);
              targetLocation = availableLocs[0] || 'Bangalore';
            }

            // Resolve company if not already set
            if (!targetSocietyId) {
              const firstCompany = structure.flatMap(g => g.companies).find(c => c.location === targetLocation) || structure[0]?.companies[0];
              if (firstCompany) {
                targetSocietyId = firstCompany.id;
              }
            }

            const resolvedCompany = structure.flatMap(g => g.companies).find(c => c.id === targetSocietyId);
            const defaultDateStr = user.createdAt ? user.createdAt.split('T')[0] : undefined;
            const updatedUser = {
              ...user,
              location: targetLocation,
              locationId: targetLocation,
              societyId: targetSocietyId,
              societyName: resolvedCompany?.name || user.societyName || 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD',
              joiningDate: user.joiningDate || defaultDateStr,
              earnedLeaveOpeningDate: user.earnedLeaveOpeningDate || user.joiningDate || defaultDateStr,
              sickLeaveOpeningDate: user.sickLeaveOpeningDate || user.joiningDate || defaultDateStr,
              compOffOpeningDate: user.compOffOpeningDate || user.joiningDate || defaultDateStr,
              floatingLeaveOpeningDate: user.floatingLeaveOpeningDate || user.joiningDate || defaultDateStr,
              childCareLeaveOpeningDate: user.childCareLeaveOpeningDate || user.joiningDate || defaultDateStr,
            };
            reset(updatedUser);

            setSelectedSociety(targetSocietyId);
            setSelectedLocation(targetLocation);
            setValue('societyId', targetSocietyId);
            setValue('societyName', updatedUser.societyName);
            setValue('locationId', targetLocation);
            setValue('location', targetLocation);

            // 2. AUTOMATIC MATRIX SITE MAPPING + MANDATORY HEAD OFFICE
            const headOfficeId = targetSocietyId ? `${targetSocietyId}_head_office` : 'head_office';
            const assignedIdsSet = new Set<string>();
            
            // Mandatory Head Office check
            assignedIdsSet.add(headOfficeId);

            // Existing IDs on user profile
            if (user.organizationId) {
              user.organizationId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
                assignedIdsSet.add(id);
              });
            }

            // Auto-detect matching matrix records for this user (e.g. Poojashree S -> 52 sites)
            const userMatrixSites = getMatrixSitesForUser(user, matrix);
            userMatrixSites.forEach(m => {
              const siteEntityId = resolveSiteEntityId(m.siteName, structure, orgs, m);
              if (siteEntityId) {
                assignedIdsSet.add(siteEntityId);
              }
            });

            const finalIds = Array.from(assignedIdsSet);
            setSelectedSiteIds(finalIds);
          }
        } else {
          const uniqueLocations = new Set<string>();
          structure.forEach(group => {
            if (Array.isArray(group.locations)) {
              group.locations.forEach(loc => { if (loc) uniqueLocations.add(loc); });
            }
            group.companies.forEach(company => {
              if (company.location) uniqueLocations.add(company.location);
              company.entities.forEach(entity => {
                if (entity.location) uniqueLocations.add(entity.location);
              });
            });
          });
          const availableLocs = Array.from(uniqueLocations);
          const defaultLoc = availableLocs[0] || 'Bangalore';
          setSelectedLocation(defaultLoc);
          reset({ name: '', email: '', role: 'field_staff', joiningDate: maxJoiningDate, locationId: defaultLoc, location: defaultLoc });
        }
      } catch (error) {
        setToast({ message: 'Failed to load form data.', type: 'error' });
      }
    };
    fetchData();
  }, [id, isEditing, reset, maxJoiningDate, resolveSiteEntityId]);

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locId = e.target.value;
    setSelectedLocation(locId);
    setValue('locationId', locId, { shouldDirty: true, shouldValidate: true });
    setValue('location', locId, { shouldDirty: true, shouldValidate: true });
    // Note: Do NOT clear selectedSiteIds or organizationId to prevent accidental wiping of user sites
  };

  // Derived options for Societies and Entities
  const locations = React.useMemo(() => {
    const uniqueLocations = new Set<string>();
    orgStructure.forEach(group => {
      if (Array.isArray(group.locations)) {
        group.locations.forEach(loc => { if (loc) uniqueLocations.add(loc); });
      }
      group.companies.forEach(company => {
        if (company.location) uniqueLocations.add(company.location);
        company.entities.forEach(entity => {
          if (entity.location) uniqueLocations.add(entity.location);
        });
      });
    });
    return Array.from(uniqueLocations).sort();
  }, [orgStructure]);

  const availableCompanies = React.useMemo(() => {
    if (!selectedLocation) {
      // Fallback: return all companies across structure
      return orgStructure.flatMap(g => g.companies).map(c => ({ id: c.id, name: c.name }));
    }
    const companies: { id: string, name: string }[] = [];
    orgStructure.forEach(group => {
      group.companies.forEach(company => {
        const matchesLoc = company.location === selectedLocation || 
                         company.entities.some(e => e.location === selectedLocation);
        if (matchesLoc) {
          companies.push({ id: company.id, name: company.name });
        }
      });
    });
    return companies.length > 0 ? companies : orgStructure.flatMap(g => g.companies).map(c => ({ id: c.id, name: c.name }));
  }, [orgStructure, selectedLocation]);

  const availableEntities = React.useMemo(() => {
    const entities: { id: string, name: string }[] = [];
    const seen = new Set<string>();

    // 1. Entities belonging to the selected company
    orgStructure.forEach(group => {
      group.companies.forEach(company => {
        if (!selectedSociety || company.id === selectedSociety) {
          company.entities.forEach(entity => {
            if (!seen.has(entity.id)) {
              seen.add(entity.id);
              entities.push({ id: entity.id, name: entity.name });
            }
          });
        }
      });
    });

    // 2. Also include legacy organizations
    organizations.forEach(org => {
      const orgDisplayName = org.shortName || (org as any).name || (org as any).fullName;
      if (!seen.has(org.id) && orgDisplayName) {
        seen.add(org.id);
        entities.push({ id: org.id, name: orgDisplayName });
      }
    });

    // 3. Also include all sites from matrixData so that any mapped site can be checked
    matrixData.forEach(m => {
      if (!m.siteName) return;
      const cleanAlpha = m.siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existing = entities.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha);
      if (!existing) {
        const synthId = m.id || `ent_${m.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        if (!seen.has(synthId)) {
          seen.add(synthId);
          entities.push({ id: synthId, name: m.siteName });
        }
      }
    });

    // 4. Also include any entities currently selected in selectedSiteIds even if from another company
    if (selectedSiteIds.length > 0) {
      orgStructure.forEach(group => {
        group.companies.forEach(company => {
          company.entities.forEach(entity => {
            if (selectedSiteIds.includes(entity.id) && !seen.has(entity.id)) {
              seen.add(entity.id);
              entities.push({ id: entity.id, name: entity.name });
            }
          });
        });
      });
    }

    // Sort entities alphabetically by name
    return entities.sort((a, b) => a.name.localeCompare(b.name));
  }, [orgStructure, organizations, matrixData, selectedSociety, selectedSiteIds]);

  // Synchronize selectedSiteIds changes to form values
  useEffect(() => {
    if (selectedSiteIds.length > 0) {
      setValue('organizationId', selectedSiteIds.join(','));
      
      const names: string[] = [];
      selectedSiteIds.forEach(id => {
        if (id.endsWith('_head_office') || id === 'head_office') {
          names.push('Head Office');
        } else {
          // Check organizations first
          const org = organizations.find(o => o.id === id);
          if (org?.shortName) {
            names.push(org.shortName);
          } else {
            const ent = availableEntities.find(e => e.id === id);
            if (ent) {
              names.push(ent.name);
            } else {
              const m = matrixData.find(mat => mat.id === id);
              if (m) names.push(m.siteName);
            }
          }
        }
      });
      setValue('organizationName', names.join(', '));
      setValue('noSiteAssignment', false);
    } else {
      setValue('organizationId', '');
      setValue('organizationName', '');
    }
  }, [selectedSiteIds, availableEntities, organizations, matrixData, setValue]);

  const handleSocietyChange = (socId: string) => {
    setSelectedSociety(socId);
    setValue('societyId', socId);
    const socName = availableCompanies.find(c => c.id === socId)?.name || '';
    setValue('societyName', socName);

    // Keep all selected site IDs and update the head office ID to match the new company
    setSelectedSiteIds(prev => {
      const filtered = prev.filter(id => !id.endsWith('_head_office') && id !== 'head_office');
      return [`${socId}_head_office`, ...filtered];
    });
  };

  /** Manual / One-click Remap from Site Responsibility Matrix */
  const handleRemapFromMatrix = useCallback(() => {
    const userForMapping: Partial<User> = {
      ...(initialData || {}),
      name: watch('name') || initialData?.name,
      email: watch('email') || initialData?.email,
      role: watch('role') || initialData?.role,
      id: id || initialData?.id
    };

    const targetSocId = selectedSociety || watch('societyId') || 'comp_1774006215885';
    const headOfficeId = `${targetSocId}_head_office`;
    const newAssignedSet = new Set<string>();

    // Mandatory Head Office
    newAssignedSet.add(headOfficeId);

    // Matrix matches
    const matchedMatrixSites = getMatrixSitesForUser(userForMapping, matrixData);
    matchedMatrixSites.forEach(m => {
      const entId = resolveSiteEntityId(m.siteName, orgStructure, organizations, m);
      if (entId) newAssignedSet.add(entId);
    });

    const newIds = Array.from(newAssignedSet);
    setSelectedSiteIds(newIds);
    setToast({ 
      message: `⚡ Auto-mapped ${newIds.length - 1} sites from Responsibility Matrix (+ Head Office).`, 
      type: 'success' 
    });
  }, [initialData, watch, id, selectedSociety, matrixData, orgStructure, organizations, resolveSiteEntityId]);

  const renderSiteMultiSelect = () => {
    const headOfficeId = selectedSociety ? `${selectedSociety}_head_office` : 'head_office';
    const options = [
      { id: headOfficeId, name: 'Head Office', isHeadOffice: true },
      ...availableEntities.filter(e => !e.id.endsWith('_head_office') && e.id !== 'head_office')
    ];

    const filteredOptions = options.filter(opt => {
      if (!siteSearchTerm.trim()) return true;
      return opt.name.toLowerCase().includes(siteSearchTerm.toLowerCase());
    });

    const handleSelectAllFiltered = () => {
      const idsToAdd = filteredOptions.map(o => o.id);
      setSelectedSiteIds(prev => Array.from(new Set([...prev, headOfficeId, ...idsToAdd])));
    };

    const handleClearAll = () => {
      // Head Office is mandatory for office staff working from HQ
      setSelectedSiteIds([headOfficeId]);
    };

    return (
      <div>
        <div className="mb-1.5 flex flex-wrap justify-between items-center gap-2">
          <label className="block text-sm font-medium text-muted">
            <span className="font-semibold text-slate-800">Assigned Site(s) (Entity)</span>
            <span className="ml-2 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {selectedSiteIds.length} selected
            </span>
          </label>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleRemapFromMatrix}
              title="Auto-fetch and select all sites mapped to this user in the Site Responsibility Matrix"
              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-300 transition-colors shadow-xs"
            >
              <RefreshCw className="h-3 w-3" />
              <span>⚡ Remap from Matrix</span>
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-500 hover:text-red-600 font-semibold hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Quick site search filter */}
        <div className="mb-2">
          <input
            type="text"
            placeholder="Search & filter assigned sites..."
            value={siteSearchTerm}
            onChange={(e) => setSiteSearchTerm(e.target.value)}
            className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all shadow-xs"
          />
        </div>

        <div className="border border-gray-200 rounded-xl p-2 bg-white max-h-56 overflow-y-auto space-y-1 shadow-inner transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-400 italic">
              No sites matching "{siteSearchTerm}"
            </div>
          ) : (
            filteredOptions.map(opt => {
              const isHeadOffice = (opt as any).isHeadOffice || opt.id.endsWith('_head_office') || opt.id === 'head_office';
              // Head Office is mandatory for staff working from HQ
              const isChecked = isHeadOffice || selectedSiteIds.includes(opt.id);
              
              return (
                <label 
                  key={opt.id} 
                  className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isChecked 
                      ? 'bg-emerald-50/70 border-l-2 border-emerald-500 font-medium text-emerald-950' 
                      : 'hover:bg-slate-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isHeadOffice}
                      onChange={(e) => {
                        if (isHeadOffice) return; // Mandatory check
                        if (e.target.checked) {
                          setSelectedSiteIds(prev => [...prev, opt.id]);
                        } else {
                          setSelectedSiteIds(prev => prev.filter(id => id !== opt.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-80"
                    />
                    <span className="text-sm select-none">{opt.name}</span>
                  </div>

                  {isHeadOffice && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Mandatory (HQ)
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
        {errors.organizationId?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.organizationId.message}</p>
        )}
      </div>
    );
  };
  /** Save the user AND update the roleMapping in one action */
  const saveUserWithCategory = async (data: any, chosenCategory: 'site' | 'field' | 'office') => {
    setShowCategoryModal(false);
    setIsSubmitting(true);
    try {
      // 1. Add this role to the chosen category in attendance settings
      if (data.role && attendanceSettings) {
        const currentMapping = (attendanceSettings as any).missedCheckoutConfig?.roleMapping || {
          office: [], field: [], site: []
        };
        const updatedMapping = {
          ...currentMapping,
          [chosenCategory]: [...(currentMapping[chosenCategory] || []), data.role]
        };
        const updatedSettings: AttendanceSettings = {
          ...attendanceSettings,
          missedCheckoutConfig: {
            ...(attendanceSettings as any).missedCheckoutConfig,
            roleMapping: updatedMapping
          }
        };
        await api.updateAttendanceSettings(updatedSettings);
        setAttendanceSettings(updatedSettings);
        console.log(`✅ Role '${data.role}' auto-synced to '${chosenCategory}' staff category`);
      }
      // 2. Now save the user normally
      await onSubmit(data);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save.', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const onSubmit: SubmitHandler<Partial<User> & { password?: string; noSiteAssignment?: boolean }> = async (data) => {
    // Auto-sync check: if role is not mapped to any category, pause and ask admin
    const rm = (attendanceSettings as any)?.missedCheckoutConfig?.roleMapping || {};
    const isExplicitlyMapped = [
      ...(rm.office || []), ...(rm.field || []), ...(rm.site || [])
    ].some((r: string) => r.toLowerCase() === (data.role || '').toLowerCase());

    if (data.role && !isExplicitlyMapped) {
      setPendingSubmitData(data);
      setShowCategoryModal(true);
      setIsSubmitting(false);
      return; // Stop here — modal will call saveUserWithCategory
    }

    setIsSubmitting(true);
    
    // Final surgical cleanup: converting empty strings and undefined to null for database compatibility.
    // This prevents errors with non-text columns (like DATE or UUID) when optional fields are left empty.
    const cleanPayload = (payload: any) => {
      const cleaned = { ...payload };
      Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === '' || cleaned[key] === undefined) {
          cleaned[key] = null;
        }
      });
      return cleaned;
    };

    try {
      // Ensure the role entry exists in the database with Technician permissions
      if (data.role) {
        const roleObj = roles.find(r => r.id === data.role);
        if (roleObj) {
          await api.ensureRoleExists(roleObj.id, roleObj.displayName || roleObj.id);
        }
      }

      // Map the string geographic locationId back to the true Organization Group UUID 
      // that the database foreign key expects
      const processedData = { ...data };

      // Auto-set joining date and leave opening dates if giving access (role is not unverified/gate_only) and empty
      if (processedData.role && processedData.role !== 'unverified' && processedData.role !== 'gate_only') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!processedData.joiningDate) {
          processedData.joiningDate = todayStr;
        }
        const targetJoiningDate = processedData.joiningDate;
        if (targetJoiningDate) {
          if (!processedData.earnedLeaveOpeningDate) processedData.earnedLeaveOpeningDate = targetJoiningDate;
          if (!processedData.sickLeaveOpeningDate) processedData.sickLeaveOpeningDate = targetJoiningDate;
          if (!processedData.compOffOpeningDate) processedData.compOffOpeningDate = targetJoiningDate;
          if (!processedData.floatingLeaveOpeningDate) processedData.floatingLeaveOpeningDate = targetJoiningDate;
          if (!processedData.childCareLeaveOpeningDate) processedData.childCareLeaveOpeningDate = targetJoiningDate;
        }
      }
      // 1. Explicitly preserve the human-readable location region (e.g. 'Bangalore')
      const targetLoc = selectedLocation || (data as any).location || (data as any).locationId || 'Bangalore';
      processedData.location = targetLoc;

      // 2. Map locationId to the valid Organization Group ID for PostgreSQL foreign key
      let resolvedGroupId = '';
      if (processedData.societyId) {
        const matchingGroup = orgStructure.find(g => 
          g.companies.some(c => c.id === processedData.societyId)
        );
        if (matchingGroup) {
          resolvedGroupId = matchingGroup.id;
        }
      }
      if (!resolvedGroupId) {
        const matchingGroup = orgStructure.find(g => 
          (Array.isArray(g.locations) && g.locations.includes(targetLoc)) ||
          g.companies.some(c => c.location === targetLoc)
        );
        if (matchingGroup) {
          resolvedGroupId = matchingGroup.id;
        }
      }
      processedData.locationId = resolvedGroupId || '';

      // Intercept Head Office pseudo-entity IDs and convert them to null/filter them
      // so the database doesn't throw a foreign key error on organization_id
      if (processedData.organizationId) {
        const ids = processedData.organizationId.split(',').filter(id => !id.endsWith('_head_office'));
        processedData.organizationId = ids.join(',');
        
        const names = (processedData.organizationName || '').split(', ').filter(name => name !== 'Head Office');
        processedData.organizationName = names.join(', ');
      }

      if (isEditing && id) {
        const { password, noSiteAssignment, ...rest } = processedData;
        const payload = cleanPayload(rest);
        await api.updateUser(id, payload);

        // Send alert notification to the user if email or phone was updated
        if (payload.email || payload.phone) {
          try {
            await api.createNotification({
              userId: id,
              type: 'info',
              message: `Your login and profile contact details have been updated by admin. Email: ${payload.email || 'unchanged'}, Phone: ${payload.phone || 'unchanged'}. Please use this email for future logins.`,
              linkTo: '#/profile'
            });
          } catch (notifErr) {
            console.warn('[AddUserPage] Failed to dispatch user notification alert:', notifErr);
          }
        }

        setToast({ message: 'User updated successfully! Alert notification sent.', type: 'success' });
      } else {
        const { name, email, password, role, noSiteAssignment, ...rest } = processedData;
        if (!password) {
          throw new Error('Password is required when creating a new user');
        }
        
        // 1. Create the Auth user
        const newUser = await api.createAuthUser({ name, email, password, role });
        
        // 2. Hydrate additional profile data
        const payload = cleanPayload(rest);

        if (Object.keys(payload).length > 0) {
          try {
            await api.updateUser(newUser.id, payload);
          } catch (updateErr) {
            console.warn('Failed to update additional user fields after creation:', updateErr);
          }
        }
        
        // 3. Attempt to create a welcome notification
        // Wrapped in try-catch so notification failure doesn't block the main flow
        try {
          await api.createNotification({
            userId: newUser.id,
            message: `Welcome ${newUser.name}! Your account has been created.`,
            type: 'greeting',
          });
        } catch (notifErr) {
          console.warn('Failed to create welcome notification (possible RLS violation):', notifErr);
        }
        
        setToast({ message: 'User created successfully! They can now sign in with their credentials.', type: 'success' });
      }
      setTimeout(() => navigate('/admin/users'), 2000);
    } catch (error: any) {
      console.error('Submit Error:', error);
      setToast({ message: error.message || 'Failed to save user.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isMobile) {

    return (
      <div className="h-full flex flex-col">
        <header className="p-4 flex-shrink-0 fo-mobile-header">
          <h1>{isEditing ? 'Edit User' : 'Add User'}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <div className="bg-card rounded-2xl p-6 space-y-6">
            <div className="text-center">
              <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                <UserPlus className="h-8 w-8 text-accent-dark" />
              </div>
              <h2 className="text-xl font-bold text-primary-text">{isEditing ? 'Edit User' : 'Add New User'}</h2>
              <p className="text-sm text-gray-400">
                {isEditing ? 'Update user information below.' : 'Create a new user account with initial credentials.'}
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Full Name" id="name" registration={register('name')} error={errors.name?.message} />
              <Input label="Email" id="email" type="email" registration={register('email')} error={errors.email?.message} />
              <Input label="Phone Number" id="phone" type="tel" registration={register('phone')} error={errors.phone?.message} placeholder="e.g. 6366381663" />
              <Select label="Role" id="role" registration={register('role')} error={errors.role?.message}>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.displayName}</option>
                ))}
              </Select>
              {(() => {
                const selectedIds = watch('organizationId') ? watch('organizationId').split(',').map(s => s.trim()) : [];
                const siteDevices = allDevices.filter(d => selectedIds.includes(d.organizationId));
                return watch('organizationId') && siteDevices.length > 0 && (
                  <Input label="Biometric Device ID (eSSL ID) (Optional)" id="biometricId" registration={register('biometricId')} error={(errors as any).biometricId?.message} placeholder="e.g. 101" />
                );
              })()}
              {!isEditing && (
                <Input
                  label="Password"
                  id="password"
                  type="password"
                  registration={register('password')}
                  error={(errors as any).password?.message}
                />
              )}
              <Select label="Location (Region)" id="locationId" registration={register('locationId')} value={selectedLocation || locationId || ''} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
                <option value="">Select a Location</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </Select>
              
              <Select label="Society (Company)" id="societyId" registration={register('societyId')} value={societyId || ''} onChange={(e) => handleSocietyChange(e.target.value)} error={(errors as any).societyId?.message} disabled={!selectedLocation}>
                <option value="">Select a Society</option>
                {availableCompanies.map(soc => (
                  <option key={soc.id} value={soc.id}>{soc.name}</option>
                ))}
              </Select>

              {renderSiteMultiSelect()}
              
              {role && (() => {
                const category = getStaffCategory(role, watch('organizationId'), attendanceSettings);
                const rm = (attendanceSettings as any)?.missedCheckoutConfig?.roleMapping || {};
                const isExplicitlyMapped = [
                  ...(rm.office || []),
                  ...(rm.field || []),
                  ...(rm.site || [])
                ].some((r: string) => r.toLowerCase() === role.toLowerCase());

                if (!isExplicitlyMapped) {
                  return (
                    <div className="bg-orange-50/80 p-3 rounded-lg border border-orange-200 flex items-start gap-2 mt-2">
                      <span className="text-xl leading-none">⚠️</span>
                      <div>
                        <h4 className="text-sm font-semibold text-orange-900">Role Not Categorized!</h4>
                        <p className="text-xs text-orange-800/80 mt-0.5">
                          The role <strong>{role}</strong> is not mapped to any staff category.
                          Go to <a href="#/hr/attendance-settings" className="underline font-bold text-orange-700">Attendance Settings → Staff Selections</a> and add this role to <strong>Site Staff</strong>, <strong>Office</strong>, or <strong>Field</strong> before saving.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mt-2 flex items-start gap-2">
                    <span className="text-xl leading-none">ℹ️</span>
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-900">Staff Category Status</h4>
                      <p className="text-xs text-indigo-800/80 mt-1 flex flex-col gap-0.5">
                        <span>Based on the selected <strong>Role</strong> and <strong>Assigned Site</strong>, this user is categorized as:</span>
                        <strong className={`capitalize text-[13px] py-0.5 px-2 rounded-md self-start mt-1 border shadow-sm ${
                          category === 'site' ? 'text-emerald-700 bg-emerald-100/50 border-emerald-200/50' :
                          category === 'field' ? 'text-amber-700 bg-amber-100/50 border-amber-200/50' :
                          'text-indigo-700 bg-indigo-100/50 border-indigo-200/50'
                        }`}>
                          {category === 'site' ? '🏗️' : category === 'field' ? '🏃' : '🏢'} {category} Staff
                          {category === 'site' ? ' — No BL/PL on holidays' : ''}
                        </strong>
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5 mt-4">
                <label className="block text-sm font-medium text-slate-700">Custom Weekly Off Days</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                    const currentDays = watch('weeklyOffDays') || [];
                    const isSelected = currentDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const newDays = isSelected 
                            ? currentDays.filter(d => d !== idx)
                            : [...currentDays, idx].sort();
                          setValue('weeklyOffDays', newDays, { shouldValidate: true, shouldDirty: true });
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          isSelected 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted">Leave empty to use the company/site default weekly off.</p>
              </div>

              {!watch('organizationId') && (
                <div className="flex items-center gap-2 mt-2 px-1">
                  <input
                    type="checkbox"
                    id="noSiteAssignment"
                    {...register('noSiteAssignment')}
                    className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <label htmlFor="noSiteAssignment" className="text-sm text-muted cursor-pointer">
                    This user does not require a site assignment
                  </label>
                </div>
              )}
              {watch('organizationId') && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                  <h4 className="text-sm font-semibold text-primary-text mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent"></span>
                    Devices at Site
                  </h4>
                  <div className="space-y-1">
                    {(() => {
                      const selectedIds = watch('organizationId') ? watch('organizationId').split(',').map(s => s.trim()) : [];
                      const siteDevices = allDevices.filter(d => selectedIds.includes(d.organizationId));
                      return siteDevices.length > 0 ? (
                        siteDevices.map(device => (
                          <p key={device.id} className="text-xs text-muted flex justify-between">
                            <span>{device.name}</span>
                            <span className="font-mono">{device.sn}</span>
                          </p>
                        ))
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted italic">No biometric devices found.</p>
                          <p className="text-[10px] text-accent-dark bg-accent/5 p-2 rounded border border-accent/10">
                            Mobile app check-in/out will be used for this site. Biometric ID is not mandatory.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-primary-text mb-4">Earned Leave Initial Balance</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Opening Balance (Days)" 
                      type="number" 
                      step="0.5" 
                      registration={register('earnedLeaveOpeningBalance')} 
                      error={errors.earnedLeaveOpeningBalance?.message}
                    />
                    <Input 
                      label="Opening Date" 
                      type="date" 
                      registration={register('earnedLeaveOpeningDate')} 
                      error={errors.earnedLeaveOpeningDate?.message}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-primary-text mb-4">Sick Leave Initial Balance</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Opening Balance (Days)" 
                      type="number" 
                      step="0.5" 
                      registration={register('sickLeaveOpeningBalance')} 
                      error={errors.sickLeaveOpeningBalance?.message}
                    />
                    <Input 
                      label="Opening Date" 
                      type="date" 
                      registration={register('sickLeaveOpeningDate')} 
                      error={errors.sickLeaveOpeningDate?.message}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-primary-text mb-4">Comp Off Initial Balance</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Opening Balance (Days)" 
                      type="number" 
                      step="0.5" 
                      registration={register('compOffOpeningBalance')} 
                      error={errors.compOffOpeningBalance?.message}
                    />
                    <Input 
                      label="Opening Date" 
                      type="date" 
                      registration={register('compOffOpeningDate')} 
                      error={errors.compOffOpeningDate?.message}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-primary-text mb-4">Floating Leave Initial Balance</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Opening Balance (Days)" 
                      type="number" 
                      step="0.5" 
                      registration={register('floatingLeaveOpeningBalance')} 
                      error={errors.floatingLeaveOpeningBalance?.message}
                    />
                    <Input 
                      label="Opening Date" 
                      type="date" 
                      registration={register('floatingLeaveOpeningDate')} 
                      error={errors.floatingLeaveOpeningDate?.message}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
        <footer className="p-4 flex-shrink-0 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            disabled={isSubmitting}
            className="fo-btn-secondary px-6"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="fo-btn-primary flex-1"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create User'}
          </button>
        </footer>
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        {showCategoryModal && pendingSubmitData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-2">🔔</div>
                <h3 className="text-lg font-bold text-gray-900">New Role Detected</h3>
                <p className="text-sm text-gray-500 mt-1">
                  The role <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{pendingSubmitData.role}</span> isn't categorized yet.
                </p>
                <p className="text-xs text-gray-400 mt-1">Which staff group does this role belong to?</p>
              </div>
              <div className="space-y-2">
                <button onClick={() => saveUserWithCategory(pendingSubmitData, 'site')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left">
                  <span className="text-2xl">🏗️</span>
                  <div>
                    <div className="font-semibold text-emerald-800 text-sm">Site Staff</div>
                    <div className="text-xs text-emerald-600">No BL/PL — gets P on 3rd Saturday & holidays</div>
                  </div>
                </button>
                <button onClick={() => saveUserWithCategory(pendingSubmitData, 'field')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left">
                  <span className="text-2xl">🏃</span>
                  <div>
                    <div className="font-semibold text-amber-800 text-sm">Field Staff</div>
                    <div className="text-xs text-amber-600">PL/P eligible — follows field holiday rules</div>
                  </div>
                </button>
                <button onClick={() => saveUserWithCategory(pendingSubmitData, 'office')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <div className="font-semibold text-indigo-800 text-sm">Office Staff</div>
                    <div className="text-xs text-indigo-600">BL/PL eligible — follows office holiday rules</div>
                  </div>
                </button>
              </div>
              <button onClick={() => { setShowCategoryModal(false); setPendingSubmitData(null); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="bg-card p-8 rounded-xl shadow-card w-full">
        <div className="flex items-center mb-6">
          <div className="bg-accent-light p-3 rounded-full mr-4">
            <UserPlus className="h-8 w-8 text-accent-dark" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary-text">{isEditing ? 'Edit User' : 'Add New User'}</h2>
            <p className="text-muted">
              {isEditing ? 'Update user information below.' : 'Create a new user account with initial credentials.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input label="Full Name" id="name" registration={register('name')} error={errors.name?.message} />
          <Input label="Email" id="email" type="email" registration={register('email')} error={errors.email?.message} />
          <Input label="Phone Number" id="phone" type="tel" registration={register('phone')} error={errors.phone?.message} placeholder="e.g. 6366381663" />
          <Select label="Role" id="role" registration={register('role')} error={errors.role?.message}>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.displayName}</option>
            ))}
          </Select>
          {(() => {
            const selectedIds = watch('organizationId') ? watch('organizationId').split(',').map(s => s.trim()) : [];
            const siteDevices = allDevices.filter(d => selectedIds.includes(d.organizationId));
            return watch('organizationId') && siteDevices.length > 0 && (
              <Input label="Biometric Device ID (eSSL ID) (Optional)" id="biometricId" registration={register('biometricId')} error={(errors as any).biometricId?.message} placeholder="e.g. 101" />
            );
          })()}
          {!isEditing && (
            <Input
              label="Password"
              id="password"
              type="password"
              registration={register('password')}
              error={(errors as any).password?.message}
            />
          )}
          <Select label="Location (Region)" id="locationId" registration={register('locationId')} value={selectedLocation || locationId || ''} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
            <option value="">Select a Location</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </Select>
          
          <Select label="Society (Company)" id="societyId" registration={register('societyId')} value={societyId || ''} onChange={(e) => handleSocietyChange(e.target.value)} error={(errors as any).societyId?.message} disabled={!selectedLocation}>
            <option value="">Select a Society</option>
            {availableCompanies.map(soc => (
              <option key={soc.id} value={soc.id}>{soc.name}</option>
            ))}
          </Select>

          {renderSiteMultiSelect()}

          {role && (() => {
            const category = getStaffCategory(role, watch('organizationId'), attendanceSettings);
            const rm = (attendanceSettings as any)?.missedCheckoutConfig?.roleMapping || {};
            const isExplicitlyMapped = [
              ...(rm.office || []),
              ...(rm.field || []),
              ...(rm.site || [])
            ].some((r: string) => r.toLowerCase() === role.toLowerCase());

            if (!isExplicitlyMapped) {
              return (
                <div className="bg-orange-50/80 p-4 rounded-xl border border-orange-300 flex items-start gap-3 shadow-sm">
                  <span className="text-2xl leading-none mt-0.5">⚠️</span>
                  <div>
                    <h4 className="text-sm font-semibold text-orange-900">Role Not Categorized!</h4>
                    <p className="text-sm text-orange-800/80 mt-1">
                      The role <strong>{role}</strong> is not mapped to any staff category.
                      This means attendance rules (BL, PL, 3rd Saturday) may be applied incorrectly.
                    </p>
                    <a
                      href="#/hr/attendance-settings"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-orange-700 underline"
                    >
                      → Go to Attendance Settings → Staff Selections to fix this
                    </a>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3 shadow-sm">
                <span className="text-2xl leading-none mt-0.5">ℹ️</span>
                <div>
                  <h4 className="text-sm font-semibold text-indigo-900">Staff Category Assignment</h4>
                  <p className="text-sm text-indigo-800/80 mt-1">
                    Based on the selected <strong>Role</strong> and <strong>Assigned Site</strong> configuration, this user will automatically follow the rules of:
                  </p>
                  <div className="mt-2 inline-block">
                    <span className={`font-bold capitalize text-sm py-1 px-3 rounded-lg border shadow-sm ${
                      category === 'site' ? 'text-emerald-700 bg-emerald-100 border-emerald-200' :
                      category === 'field' ? 'text-amber-700 bg-amber-100 border-amber-200' :
                      'text-indigo-700 bg-indigo-100 border-indigo-200'
                    }`}>
                      {category === 'site' ? '🏗️' : category === 'field' ? '🏃' : '🏢'} {category} Staff
                      {category === 'site' ? ' — No BL/PL on holidays' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="space-y-1.5 mt-4">
            <label className="block text-sm font-medium text-slate-700">Custom Weekly Off Days</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                const currentDays = watch('weeklyOffDays') || [];
                const isSelected = currentDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const newDays = isSelected 
                        ? currentDays.filter(d => d !== idx)
                        : [...currentDays, idx].sort();
                      setValue('weeklyOffDays', newDays, { shouldValidate: true, shouldDirty: true });
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      isSelected 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted">Leave empty to use the company/site default weekly off.</p>
          </div>

          {!watch('organizationId') && (
            <div className="flex items-center gap-2 mt-2 px-1 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
              <input
                type="checkbox"
                id="noSiteAssignmentDesktop"
                {...register('noSiteAssignment')}
                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
              />
              <label htmlFor="noSiteAssignmentDesktop" className="text-sm text-amber-800 cursor-pointer font-medium">
                I confirm this user does not require a site assignment (Declaration)
              </label>
            </div>
          )}

          {watch('organizationId') && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-primary-text mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent"></span>
                Biometric Devices at this Site
              </h4>
              <div className="space-y-2">
                {(() => {
                  const selectedIds = watch('organizationId') ? watch('organizationId').split(',').map(s => s.trim()) : [];
                  const siteDevices = allDevices.filter(d => selectedIds.includes(d.organizationId));
                  return siteDevices.length > 0 ? (
                    siteDevices.map(device => (
                      <div key={device.id} className="text-xs flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span className="font-medium">{device.name}</span>
                        <span className="text-muted font-mono">{device.sn}</span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted italic">No biometric devices found at this site.</p>
                      <p className="text-xs text-accent-dark bg-accent/5 p-3 rounded-lg border border-accent/20">
                        <strong>Note:</strong> Mobile app check-in/out will be used for this site as no biometric devices are available. You can leave the Biometric Device ID empty.
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 space-y-8">
            <h3 className="text-xl font-bold text-primary-text flex items-center gap-2 mb-2">
              <Calendar className="h-6 w-6 text-accent" />
              Leave Balance Initialization
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {/* Joining Date */}
              <div className="space-y-4">
                <h4 className="font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block text-sm">Joining Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Joining Date" 
                    type="date" 
                    min={minDateLimit}
                    max={maxJoiningDate}
                    registration={register('joiningDate')} 
                    error={errors.joiningDate?.message}
                    description="Company joining date."
                  />
                  <div className="hidden md:block" />
                </div>
              </div>

              {/* Earned Leave */}
              <div className="space-y-4">
                <h4 className="font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block text-sm">Earned Leave</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Opening Balance (Days)" 
                    type="number" 
                    step="0.5" 
                    registration={register('earnedLeaveOpeningBalance')} 
                    error={errors.earnedLeaveOpeningBalance?.message}
                    description="Initial balance."
                  />
                  <Input 
                    label="Opening Date" 
                    type="date" 
                    registration={register('earnedLeaveOpeningDate')} 
                    error={errors.earnedLeaveOpeningDate?.message}
                    description="Start date."
                  />
                </div>
              </div>

              {/* Sick Leave */}
              <div className="space-y-4">
                <h4 className="font-semibold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg inline-block text-sm">Sick Leave</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Opening Balance (Days)" 
                    type="number" 
                    step="0.5" 
                    registration={register('sickLeaveOpeningBalance')} 
                    error={errors.sickLeaveOpeningBalance?.message}
                    description="Initial balance."
                  />
                  <Input 
                    label="Opening Date" 
                    type="date" 
                    registration={register('sickLeaveOpeningDate')} 
                    error={errors.sickLeaveOpeningDate?.message}
                    description="Start date."
                  />
                </div>
              </div>

              {/* Comp Off */}
              <div className="space-y-4">
                <h4 className="font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg inline-block text-sm">Comp Off</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Opening Balance (Days)" 
                    type="number" 
                    step="0.5" 
                    registration={register('compOffOpeningBalance')} 
                    error={errors.compOffOpeningBalance?.message}
                    description="Initial balance."
                  />
                  <Input 
                    label="Opening Date" 
                    type="date" 
                    registration={register('compOffOpeningDate')} 
                    error={errors.compOffOpeningDate?.message}
                    description="Start date."
                  />
                </div>
              </div>

              {/* Floating Leave */}
              <div className="space-y-4">
                <h4 className="font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg inline-block text-sm">Floating Leave</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Opening Balance (Days)" 
                    type="number" 
                    step="0.5" 
                    registration={register('floatingLeaveOpeningBalance')} 
                    error={errors.floatingLeaveOpeningBalance?.message}
                    description="Initial balance."
                  />
                  <Input 
                    label="Opening Date" 
                    type="date" 
                    registration={register('floatingLeaveOpeningDate')} 
                    error={errors.floatingLeaveOpeningDate?.message}
                    description="Start date."
                  />
                </div>
              </div>

              {/* Child Care Leave */}
              <div className="space-y-4">
                <h4 className="font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg inline-block text-sm">Child Care Leave</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Opening Balance (Days)" 
                    type="number" 
                    step="0.5" 
                    registration={register('childCareLeaveOpeningBalance')} 
                    error={errors.childCareLeaveOpeningBalance?.message}
                    description="Initial balance."
                  />
                  <Input 
                    label="Opening Date" 
                    type="date" 
                    registration={register('childCareLeaveOpeningDate')} 
                    error={errors.childCareLeaveOpeningDate?.message}
                    description="Start date."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => navigate('/admin/users')}
              variant="secondary"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      {showCategoryModal && pendingSubmitData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">🔔</div>
              <h3 className="text-xl font-bold text-gray-900">New Role Detected!</h3>
              <p className="text-sm text-gray-500 mt-2">
                The role <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{pendingSubmitData.role}</span> isn't in any staff category yet.
              </p>
              <p className="text-xs text-gray-400 mt-1">Select a category to auto-add it to Attendance Settings and save the user in one step.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => saveUserWithCategory(pendingSubmitData, 'site')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] transition-all text-left group">
                <span className="text-3xl">🏗️</span>
                <div className="flex-1">
                  <div className="font-bold text-emerald-800">Site Staff</div>
                  <div className="text-xs text-emerald-600 mt-0.5">No BL/PL — gets <strong>P</strong> on 3rd Saturdays &amp; BL/PL days</div>
                </div>
                <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button onClick={() => saveUserWithCategory(pendingSubmitData, 'field')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] transition-all text-left group">
                <span className="text-3xl">🏃</span>
                <div className="flex-1">
                  <div className="font-bold text-amber-800">Field Staff</div>
                  <div className="text-xs text-amber-600 mt-0.5">PL/P eligible — follows field holiday rules</div>
                </div>
                <span className="text-amber-400 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button onClick={() => saveUserWithCategory(pendingSubmitData, 'office')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:scale-[0.98] transition-all text-left group">
                <span className="text-3xl">🏢</span>
                <div className="flex-1">
                  <div className="font-bold text-indigo-800">Office Staff</div>
                  <div className="text-xs text-indigo-600 mt-0.5">BL/PL eligible — follows office holiday rules</div>
                </div>
                <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
            <button onClick={() => { setShowCategoryModal(false); setPendingSubmitData(null); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-1 transition-colors">Cancel — categorize later</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddUserPage;
