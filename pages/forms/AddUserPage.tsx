import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { User, UserRole, Organization, Role, BiometricDevice, OrganizationGroup, AttendanceSettings } from '../../types';
import { getStaffCategory } from '../../utils/attendanceCalculations';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { api } from '../../services/api';
import { UserPlus, ArrowLeft, Calendar } from 'lucide-react';
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
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSociety, setSelectedSociety] = useState<string>('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
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
    if (locationId !== undefined) {
      setSelectedLocation(locationId || '');
    }
  }, [locationId]);

  useEffect(() => {
    if (societyId !== undefined) {
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgs, fetchedRoles, fetchedDevices, structure, settings, designations] = await Promise.all([
          api.getOrganizations(),
          api.getRoles(),
          api.getBiometricDevices ? api.getBiometricDevices() : Promise.resolve([]),
          api.getOrganizationStructure(),
          api.getAttendanceSettings(),
          api.getSiteStaffDesignations()
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

        if (isEditing && id) {
          const users = await api.getUsers();
          const user = users.find(u => u.id === id);
          if (user) {
            setInitialData(user);
            
            const defaultDateStr = user.createdAt ? user.createdAt.split('T')[0] : undefined;
            const updatedUser = {
              ...user,
              joiningDate: user.joiningDate || defaultDateStr,
              earnedLeaveOpeningDate: user.earnedLeaveOpeningDate || user.joiningDate || defaultDateStr,
              sickLeaveOpeningDate: user.sickLeaveOpeningDate || user.joiningDate || defaultDateStr,
              compOffOpeningDate: user.compOffOpeningDate || user.joiningDate || defaultDateStr,
              floatingLeaveOpeningDate: user.floatingLeaveOpeningDate || user.joiningDate || defaultDateStr,
              childCareLeaveOpeningDate: user.childCareLeaveOpeningDate || user.joiningDate || defaultDateStr,
            };
            reset(updatedUser);

            // Auto-resolve hierarchy for edit mode
            if (user.organizationId) {
              const ids = user.organizationId.split(',').map(s => s.trim()).filter(Boolean);
              setSelectedSiteIds(ids);

              // Find the entity in the structure
              let foundEntity: any = null;
              let foundSociety: any = null;
              let foundLocation: string | null = null;

              const uniqueLocations = new Set<string>();
              structure.forEach(group => {
                group.companies.forEach(company => {
                  if (company.location) uniqueLocations.add(company.location);
                  company.entities.forEach(entity => {
                    if (entity.location) uniqueLocations.add(entity.location);
                  });
                });
              });

              for (const siteId of ids) {
                for (const group of structure) {
                  for (const company of group.companies) {
                    const ent = company.entities.find(e => e.id === siteId);
                    if (ent) {
                      foundEntity = ent;
                      foundSociety = company;
                      foundLocation = company.location || ent.location || null;
                      if (!foundLocation) {
                        // fallback to finding matching location
                        const availableLocs = Array.from(uniqueLocations);
                        if (availableLocs.length > 0) foundLocation = availableLocs[0];
                      }
                      break;
                    }
                  }
                  if (foundEntity) break;
                }
                if (foundEntity) break;
              }

              // Fallback to checking legacy orgs list
              if (!foundEntity) {
                for (const siteId of ids) {
                  const site = orgs.find(o => o.id === siteId);
                  if (site && site.parentId) {
                    for (const group of structure) {
                      for (const company of group.companies) {
                        if (company.id === site.parentId) {
                          foundSociety = company;
                          foundLocation = company.location || site.location || null;
                          if (!foundLocation) {
                            const availableLocs = Array.from(uniqueLocations);
                            if (availableLocs.length > 0) foundLocation = availableLocs[0];
                          }
                          break;
                        }
                      }
                      if (foundSociety) break;
                    }
                  }
                  if (foundSociety) break;
                }
              }

              if (foundSociety && foundLocation) {
                setSelectedSociety(foundSociety.id);
                setSelectedLocation(foundLocation);
                setValue('societyId', foundSociety.id);
                setValue('societyName', foundSociety.name);
                // Location name is now the string location
                setValue('locationId', foundLocation);
              }
            } else if (user.societyId) {
              // User has a company but no specific site (Entity). Treat as Head Office.
              const uniqueLocations = new Set<string>();
              structure.forEach(group => {
                group.companies.forEach(company => {
                  if (company.location) uniqueLocations.add(company.location);
                });
              });
              
              let foundLocation: string | null = null;
              let foundSociety: any = null;

              for (const group of structure) {
                for (const company of group.companies) {
                  if (company.id === user.societyId) {
                    foundSociety = company;
                    foundLocation = company.location || null;
                    if (!foundLocation) {
                      const availableLocs = Array.from(uniqueLocations);
                      if (availableLocs.length > 0) foundLocation = availableLocs[0];
                    }
                    break;
                  }
                }
                if (foundSociety) break;
              }

              if (foundSociety && foundLocation) {
                setSelectedSociety(foundSociety.id);
                setSelectedLocation(foundLocation);
                setValue('societyId', foundSociety.id);
                setValue('societyName', foundSociety.name);
                setValue('locationId', foundLocation);
                
                setSelectedSiteIds([`${foundSociety.id}_head_office`]);
              }
            }
          }
        } else {
          reset({ name: '', email: '', role: 'field_staff', joiningDate: maxJoiningDate });
        }
      } catch (error) {
        setToast({ message: 'Failed to load form data.', type: 'error' });
      }
    };
    fetchData();
  }, [id, isEditing, reset, maxJoiningDate]);

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locId = e.target.value;
    setSelectedLocation(locId);
    setSelectedSociety('');
    setValue('organizationId', '');
    setValue('organizationName', '');
    setValue('societyId', '');
    setValue('societyName', '');
    setValue('locationId', locId);
  };

  // Derived options for Societies and Entities
  const locations = React.useMemo(() => {
    const uniqueLocations = new Set<string>();
    orgStructure.forEach(group => {
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
    if (!selectedLocation) return [];
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
    return companies;
  }, [orgStructure, selectedLocation]);

  const availableEntities = React.useMemo(() => {
    if (!selectedSociety) return [];
    const entities: { id: string, name: string }[] = [];
    orgStructure.forEach(group => {
      group.companies.forEach(company => {
        if (company.id === selectedSociety) {
          company.entities.forEach(entity => {
            entities.push({ id: entity.id, name: entity.name });
          });
        }
      });
    });
    return entities;
  }, [orgStructure, selectedSociety]);

  // Synchronize selectedSiteIds changes to form values
  useEffect(() => {
    if (selectedSiteIds.length > 0) {
      setValue('organizationId', selectedSiteIds.join(','));
      
      const names: string[] = [];
      selectedSiteIds.forEach(id => {
        if (id.endsWith('_head_office')) {
          names.push('Head Office');
        } else {
          // Check organizations first
          const org = organizations.find(o => o.id === id);
          if (org?.shortName) {
            names.push(org.shortName);
          } else {
            const ent = availableEntities.find(e => e.id === id);
            if (ent) names.push(ent.name);
          }
        }
      });
      setValue('organizationName', names.join(', '));
      setValue('noSiteAssignment', false);
    } else {
      setValue('organizationId', '');
      setValue('organizationName', '');
    }
  }, [selectedSiteIds, availableEntities, organizations, setValue]);

  const handleSocietyChange = (socId: string) => {
    setSelectedSociety(socId);
    setSelectedSiteIds([]); // Clear selections when company changes
    setValue('societyId', socId);
    const socName = availableCompanies.find(c => c.id === socId)?.name || '';
    setValue('societyName', socName);
  };

  const renderSiteMultiSelect = () => {
    if (!selectedSociety) {
      return (
        <div>
          <label className="block text-sm font-medium text-muted">Assigned Site(s) (Entity)</label>
          <div className="mt-1 border border-gray-200 rounded-lg p-3 bg-gray-50 text-xs text-muted italic text-center">
            Please select a Society first.
          </div>
        </div>
      );
    }

    const options = [
      { id: `${selectedSociety}_head_office`, name: 'Head Office' },
      ...availableEntities
    ];

    return (
      <div>
        <label className="block text-sm font-medium text-muted mb-1 flex justify-between items-center">
          <span>Assigned Site(s) (Entity)</span>
          <span className="text-xs text-emerald-600 font-bold">({selectedSiteIds.length} selected)</span>
        </label>
        <div className="border border-gray-200 rounded-xl p-3 bg-white max-h-48 overflow-y-auto space-y-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
          {options.map(opt => {
            const isChecked = selectedSiteIds.includes(opt.id);
            return (
              <label 
                key={opt.id} 
                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                  isChecked ? 'bg-emerald-50/45 border-l-2 border-emerald-500 font-medium' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSiteIds(prev => [...prev, opt.id]);
                    } else {
                      setSelectedSiteIds(prev => prev.filter(id => id !== opt.id));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 select-none">{opt.name}</span>
              </label>
            );
          })}
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
      if (processedData.societyId) {
        const matchingGroup = orgStructure.find(g => 
          g.companies.some(c => c.id === processedData.societyId)
        );
        if (matchingGroup) {
          processedData.locationId = matchingGroup.id;
        } else {
          // If no matching group is found, it's safer to send null than a string that will break the foreign key
          processedData.locationId = '';
        }
      } else if (processedData.locationId && !processedData.locationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
         // If they didn't select a society but selected a location string, nullify it to prevent FK constraint error
         processedData.locationId = '';
      }

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
        setToast({ message: 'User updated successfully!', type: 'success' });
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
              <Select label="Location (Region)" id="locationId" registration={register('locationId')} value={locationId || ''} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
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
          <Select label="Location (Region)" id="locationId" registration={register('locationId')} value={locationId || ''} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
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
