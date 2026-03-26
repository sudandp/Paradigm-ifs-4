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
  societyId: yup.string().optional().nullable(),
  societyName: yup.string().optional().nullable(),
  locationId: yup.string().optional().nullable(),
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
  societyId: yup.string().optional().nullable(),
  societyName: yup.string().optional().nullable(),
  locationId: yup.string().optional().nullable(),
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
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);

  const schema = isEditing ? editUserSchema : createUserSchema;
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<Partial<User> & { password?: string; noSiteAssignment?: boolean }>({
    resolver: yupResolver(schema) as unknown as Resolver<Partial<User> & { password?: string; noSiteAssignment?: boolean }>,
  });

  const role = watch('role');
  const organizationId = watch('organizationId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgs, fetchedRoles, fetchedDevices, structure, settings] = await Promise.all([
          api.getOrganizations(),
          api.getRoles(),
          api.getBiometricDevices ? api.getBiometricDevices() : Promise.resolve([]),
          api.getOrganizationStructure(),
          api.getAttendanceSettings()
        ]);
        setOrganizations(orgs);
        setRoles(fetchedRoles);
        setAllDevices(fetchedDevices);
        setOrgStructure(structure);
        setAttendanceSettings(settings);

        if (isEditing && id) {
          const users = await api.getUsers();
          const user = users.find(u => u.id === id);
          if (user) {
            setInitialData(user);
            reset(user);

            // Auto-resolve hierarchy for edit mode
            if (user.organizationId) {
              const site = orgs.find(o => o.id === user.organizationId);
              if (site && site.parentId) {
                const uniqueLocations = new Set<string>();
                structure.forEach(group => {
                  group.companies.forEach(company => {
                    if (company.location) uniqueLocations.add(company.location);
                    company.entities.forEach(entity => {
                      if (entity.location) uniqueLocations.add(entity.location);
                    });
                  });
                });
                
                // Find if the site belongs to a company that matches a location
                let foundLocation: string | null = null;
                let foundSociety: any = null;

                for (const group of structure) {
                  for (const company of group.companies) {
                    if (company.id === site.parentId) {
                      foundSociety = company;
                      // Determine the best location for this society
                      foundLocation = company.location || site.location || null;
                      if (!foundLocation) {
                        // fallback to finding matching location
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
                  // Location name is now the string location
                  setValue('locationId', foundLocation);
                }
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
                
                // Map to the exact pseudo-id used by the dropdown so it selects properly
                setValue('organizationId', `${foundSociety.id}_head_office`);
                setValue('organizationName', 'Head Office');
              }
            }
          }
        } else {
          reset({ name: '', email: '', role: 'field_staff' });
        }
      } catch (error) {
        setToast({ message: 'Failed to load form data.', type: 'error' });
      }
    };
    fetchData();
  }, [id, isEditing, reset]);

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

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    const org = organizations.find(o => o.id === orgId);
    
    // Find name from structure as fallback
    let entityName = org?.shortName || '';
    if (!entityName && orgId) {
      const entity = availableEntities.find(ent => ent.id === orgId);
      entityName = entity?.name || '';
    }

    setValue('organizationId', orgId);
    setValue('organizationName', entityName);
    if (orgId) {
      setValue('noSiteAssignment', false);
    }
  };
  const onSubmit: SubmitHandler<Partial<User> & { password?: string; noSiteAssignment?: boolean }> = async (data) => {
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
      // Map the string geographic locationId back to the true Organization Group UUID 
      // that the database foreign key expects
      const processedData = { ...data };
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

      // Intercept Head Office pseudo-entity IDs and convert them to null
      // so the database doesn't throw a foreign key error on organization_id
      if (processedData.organizationId && processedData.organizationId.endsWith('_head_office')) {
        processedData.organizationId = '';
        processedData.organizationName = '';
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
              {watch('organizationId') && allDevices.filter(d => d.organizationId === watch('organizationId')).length > 0 && (
                <Input label="Biometric Device ID (eSSL ID) (Optional)" id="biometricId" registration={register('biometricId')} error={(errors as any).biometricId?.message} placeholder="e.g. 101" />
              )}
              {!isEditing && (
                <Input
                  label="Password"
                  id="password"
                  type="password"
                  registration={register('password')}
                  error={(errors as any).password?.message}
                />
              )}
              <Select label="Location (Region)" id="locationId" registration={register('locationId')} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
                <option value="">Select a Location</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </Select>
              
              <Select label="Society (Company)" id="societyId" registration={register('societyId')} onChange={(e) => {
                const socId = e.target.value;
                setSelectedSociety(socId);
                setValue('organizationId', '');
                setValue('organizationName', '');
                setValue('societyId', socId);
                const socName = availableCompanies.find(c => c.id === socId)?.name || '';
                setValue('societyName', socName);
              }} error={(errors as any).societyId?.message} disabled={!selectedLocation}>
                <option value="">Select a Society</option>
                {availableCompanies.map(soc => (
                  <option key={soc.id} value={soc.id}>{soc.name}</option>
                ))}
              </Select>

              <Select label="Assigned Site (Entity)" id="organizationId" registration={register('organizationId')} error={errors.organizationId?.message} onChange={handleOrgChange} disabled={!selectedSociety || watch('noSiteAssignment')}>
                <option value="">Select a Site</option>
                {selectedSociety && (
                  <option value={`${selectedSociety}_head_office`}>Head Office</option>
                )}
                {availableEntities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </Select>
              
              {role && (
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mt-2 flex items-start gap-2">
                  <span className="text-xl leading-none">ℹ️</span>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-900">Staff Category Status</h4>
                    <p className="text-xs text-indigo-800/80 mt-1 flex flex-col gap-0.5">
                      <span>Based on the selected <strong>Role</strong> and <strong>Assigned Site</strong>, this user is categorized as:</span>
                      <strong className="text-indigo-700 capitalize text-[13px] bg-indigo-100/50 py-0.5 px-2 rounded-md self-start mt-1 border border-indigo-200/50 shadow-sm">
                        {getStaffCategory(role, watch('organizationId'), attendanceSettings)} Staff
                      </strong>
                    </p>
                  </div>
                </div>
              )}

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
                    {allDevices.filter(d => d.organizationId === watch('organizationId')).length > 0 ? (
                      allDevices.filter(d => d.organizationId === watch('organizationId')).map(device => (
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
                    )}
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
          {watch('organizationId') && allDevices.filter(d => d.organizationId === watch('organizationId')).length > 0 && (
            <Input label="Biometric Device ID (eSSL ID) (Optional)" id="biometricId" registration={register('biometricId')} error={(errors as any).biometricId?.message} placeholder="e.g. 101" />
          )}
          {!isEditing && (
            <Input
              label="Password"
              id="password"
              type="password"
              registration={register('password')}
              error={(errors as any).password?.message}
            />
          )}
          <Select label="Location (Region)" id="locationId" registration={register('locationId')} onChange={handleLocationChange} error={(errors as any).locationId?.message}>
            <option value="">Select a Location</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </Select>
          
          <Select label="Society (Company)" id="societyId" registration={register('societyId')} onChange={(e) => {
            const socId = e.target.value;
            setSelectedSociety(socId);
            setValue('organizationId', '');
            setValue('organizationName', '');
            setValue('societyId', socId);
            const socName = availableCompanies.find(c => c.id === socId)?.name || '';
            setValue('societyName', socName);
          }} error={(errors as any).societyId?.message} disabled={!selectedLocation}>
            <option value="">Select a Society</option>
            {availableCompanies.map(soc => (
              <option key={soc.id} value={soc.id}>{soc.name}</option>
            ))}
          </Select>

          <Select label="Assigned Site (Entity)" id="organizationId" registration={register('organizationId')} error={errors.organizationId?.message} onChange={handleOrgChange} disabled={!selectedSociety || watch('noSiteAssignment')}>
            <option value="">Select a Site (Location)</option>
            {selectedSociety && (
              <option value={`${selectedSociety}_head_office`}>Head Office</option>
            )}
            {availableEntities.map(ent => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </Select>

          {role && (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3 shadow-sm">
              <span className="text-2xl leading-none mt-0.5">ℹ️</span>
              <div>
                <h4 className="text-sm font-semibold text-indigo-900">Staff Category Assignment</h4>
                <p className="text-sm text-indigo-800/80 mt-1">
                  Based on the selected <strong>Role</strong> and <strong>Assigned Site</strong> configuration, this user will automatically follow the rules of:
                </p>
                <div className="mt-2 inline-block">
                  <span className="text-indigo-700 font-bold capitalize text-sm bg-indigo-100 py-1 px-3 rounded-lg border border-indigo-200 shadow-sm">
                    {getStaffCategory(role, watch('organizationId'), attendanceSettings)} Staff
                  </span>
                </div>
              </div>
            </div>
          )}

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
                {allDevices.filter(d => d.organizationId === watch('organizationId')).length > 0 ? (
                  allDevices.filter(d => d.organizationId === watch('organizationId')).map(device => (
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
                )}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 space-y-8">
            <h3 className="text-xl font-bold text-primary-text flex items-center gap-2 mb-2">
              <Calendar className="h-6 w-6 text-accent" />
              Leave Balance Initialization
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
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
                <h4 className="font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg inline-block text-sm">Sick Leave</h4>
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
    </div>
  );
};

export default AddUserPage;
