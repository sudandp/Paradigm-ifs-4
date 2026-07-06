import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Location, User } from '../../types';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { MapPin, Users as UsersIcon, Pin, Plus, Save, Edit, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { reverseGeocode, getPrecisePosition } from '../../utils/locationUtils';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';

/**
 * LocationManagement component
 *
 * This page allows HR/admins to manage geofenced locations used for attendance.
 * Users can create new locations by specifying a name, radius and coordinates.
 * A helper button populates the latitude/longitude using the browser's Geolocation API.
 * Locations can then be assigned to specific users so check‑ins/out only occur
 * when within range.  All existing locations are listed in a table for review.
 */

// Helper function to calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
const LocationManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [newRadius, setNewRadius] = useState<string>('100');
  const [newLatitude, setNewLatitude] = useState<string>('');
  const [newLongitude, setNewLongitude] = useState<string>('');
  const [newAddress, setNewAddress] = useState('');
  const [newKioskPin, setNewKioskPin] = useState<string>('1234');
  const [assignUserId, setAssignUserId] = useState('');
  // Allow selecting multiple locations via checkboxes instead of a single dropdown.
  const [assignLocationIds, setAssignLocationIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignSearchTerm, setAssignSearchTerm] = useState('');

  type SortField = 'name' | 'radius' | 'coordinates' | 'address' | 'kioskPin' | 'createdBy' | 'createdAt';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [activeTab, setActiveTab] = useState('Add New Location');

  const TabButton = ({ tabName, id }: { tabName: string, id: string }) => (
    <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all flex items-center gap-2 ${activeTab === id ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-primary-text'}`}
    >
        <span>{tabName}</span>
    </button>
  );

  // Track when editing an existing location.  If set, the form will
  // function as an edit form instead of create.  Stores the id of the
  // location being edited.
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Load all locations and users on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locs, usr] = await Promise.all([api.getLocations(), api.getUsers()]);
        // Sort client-side as well to ensure newest are always at top
        const sortedLocs = locs.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setLocations(sortedLocs);
        setUsers(usr);
      } catch (err) {
        console.error(err);
        setToast({ message: 'Failed to load locations or users.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Build a map of user id -> user name for quick lookup.  This is used
  // when locations are loaded without a creator name populated via
  // Supabase join (for backwards compatibility).  Newer API results
  // include a createdByName field directly on each location.
  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  // Identify duplicate coordinates for highlighting
  const duplicateCoords = React.useMemo(() => {
    const dupes = new Set<string>();
    const seen = new Set<string>();
    locations.forEach((l) => {
      const sig = `${l.latitude.toFixed(4)},${l.longitude.toFixed(4)}`;
      if (seen.has(sig)) {
        dupes.add(sig);
      } else {
        seen.add(sig);
      }
    });
    return dupes;
  }, [locations]);

  // Identify duplicate names for highlighting
  const duplicateNames = React.useMemo(() => {
    const dupes = new Set<string>();
    const seen = new Set<string>();
    locations.forEach((l) => {
      if (!l.name) return;
      const name = l.name.trim().toLowerCase();
      if (seen.has(name)) {
        dupes.add(name);
      } else {
        seen.add(name);
      }
    });
    return dupes;
  }, [locations]);

  // Identify duplicate addresses for highlighting
  const duplicateAddresses = React.useMemo(() => {
    const dupes = new Set<string>();
    const seen = new Set<string>();
    locations.forEach((l) => {
      if (!l.address) return;
      const addr = l.address.trim().toLowerCase();
      if (seen.has(addr)) {
        dupes.add(addr);
      } else {
        seen.add(addr);
      }
    });
    return dupes;
  }, [locations]);

  // Helper to refresh locations after a create or assign
  const refreshLocations = async () => {
    try {
      const locs = await api.getLocations();
      const sortedLocs = locs.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setLocations(sortedLocs);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to refresh locations.', type: 'error' });
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsFetchingLocation(true);
    setToast({ message: 'Acquiring your location, please wait...', type: 'success' });
    try {
      const pos = await getPrecisePosition();
      const { latitude, longitude } = pos.coords;
      setNewLatitude(latitude.toString());
      setNewLongitude(longitude.toString());
      // If no address or name specified yet, attempt reverse geocoding
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (!newAddress) setNewAddress(address);
        if (!newName) setNewName(address);
      } catch (err) {
        console.warn('Reverse geocode failed', err);
      }
      setToast({ message: 'Location acquired successfully! Coordinates and address have been filled.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.toLowerCase().includes('permission') 
        ? 'Location permission denied. Please enable it in settings.' 
        : 'Unable to acquire location fix. Please ensure GPS is on and you are in an open area.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleCreateLocation = async () => {
    const radiusNum = parseFloat(newRadius);
    const latNum = parseFloat(newLatitude);
    const lonNum = parseFloat(newLongitude);
    if (isNaN(radiusNum) || radiusNum < 10 || radiusNum > 1000) {
      setToast({ message: 'Radius must be between 10 and 1000 meters.', type: 'error' });
      return;
    }
    if (isNaN(latNum) || isNaN(lonNum)) {
      setToast({ message: 'Please provide valid latitude and longitude.', type: 'error' });
      return;
    }
    try {
      const address = newAddress || (await reverseGeocode(latNum, lonNum));

      if (!editingLocationId) {
        // Check for duplicate location before creating (within 10 meters)
        const duplicate = locations.find(loc => {
          const distance = calculateDistance(latNum, lonNum, loc.latitude, loc.longitude);
          return distance < 10; // Consider as duplicate if within 10 meters
        });

        if (duplicate) {
          const locName = duplicate.name || duplicate.address || 'Unnamed Location';
          setToast({ message: `A location already exists at these coordinates: "${locName}".`, type: 'error' });
          return;
        }
      }

      if (editingLocationId) {
        // Editing existing location
        await api.updateLocation(editingLocationId, {
          name: newName || address,
          latitude: latNum,
          longitude: lonNum,
          radius: radiusNum,
          address,
          kioskPin: newKioskPin || '1234',
        });
        setToast({ message: 'Location updated successfully.', type: 'success' });
        setEditingLocationId(null);
      } else {
        // Creating new location
        await api.createLocation({
          name: newName || address,
          latitude: latNum,
          longitude: lonNum,
          radius: radiusNum,
          address,
          createdBy: user?.id || null,
          kioskPin: newKioskPin || '1234',
        });
        setToast({ message: 'Location created successfully.', type: 'success' });
      }
      // Reset form fields
      setNewName('');
      setNewRadius('100');
      setNewLatitude('');
      setNewLongitude('');
      setNewAddress('');
      setNewKioskPin('1234');
      setCurrentPage(1);
      await refreshLocations();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || (editingLocationId ? 'Failed to update location.' : 'Failed to create location.');
      setToast({ message: errorMessage, type: 'error' });
    }
  };

  const handleAssignLocation = async () => {
    if (!assignUserId || assignLocationIds.length === 0) {
      setToast({ message: 'Please select a user and at least one location.', type: 'error' });
      return;
    }
    try {
      // Assign each selected location to the user
      await Promise.all(assignLocationIds.map(locId => api.assignLocationToUser(assignUserId, locId)));
      setToast({ message: 'Location(s) assigned to user.', type: 'success' });
      // Clear selections
      setAssignUserId('');
      setAssignLocationIds([]);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to assign location(s).', type: 'error' });
    }
  };

  // Begin editing a location: populate form fields with its values and scroll to form
  const handleEditLocation = (loc: Location) => {
    setEditingLocationId(loc.id);
    setNewName(loc.name || '');
    setNewRadius(loc.radius.toString());
    setNewLatitude(loc.latitude.toString());
    setNewLongitude(loc.longitude.toString());
    setNewAddress(loc.address || '');
    setNewKioskPin(loc.kioskPin || '1234');
    setActiveTab('Add New Location');

    // Scroll to the top of the page to show the edit form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cancel editing and reset form fields
  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setNewName('');
    setNewRadius('100');
    setNewLatitude('');
    setNewLongitude('');
    setNewAddress('');
    setNewKioskPin('1234');
  };

  // Delete a location after confirming
  // This will also remove the location from all users who have it assigned
  const handleDeleteLocation = async (locId: string) => {
    try {
      // The API deleteLocation should cascade delete from user_locations table
      // If it doesn't, we need to manually remove user assignments first
      await api.deleteLocation(locId);
      
      // Update local state immediately for snappy UX
      setLocations(prev => prev.filter(l => l.id !== locId));
      setToast({ message: 'Location deleted successfully from all users and database.', type: 'success' });
      
      await refreshLocations();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || 'Failed to delete location. It might be linked to existing attendance records.';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setDeleteLocationId(null);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading locations..." />;
  }

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
        <AdminPageHeader title="Location Management" />
        <p className="text-muted -mt-4 mb-6">Define geofenced locations and assign them to staff. Only check‑ins within these locations will be accepted.</p>
        
        <div className="border-b border-border overflow-x-auto no-scrollbar">
            <nav className="-mb-px flex space-x-1 sm:space-x-4 min-w-max pb-1 text-base">
                <TabButton tabName="Add New Location" id="Add New Location" />
                <TabButton tabName="Assign Location to User" id="Assign Location to User" />
                <TabButton tabName="Existing Locations" id="Existing Locations" />
            </nav>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Create or edit location form */}
        {activeTab === 'Add New Location' && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-muted" /> {editingLocationId ? 'Edit Location' : 'Add New Location'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Name (optional)" id="locName" name="locationName" autoComplete="organization" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Office HQ" />
            <Input label="Radius (meters)" id="locRadius" name="locationRadius" type="number" value={newRadius} onChange={(e) => setNewRadius(e.target.value)} min="10" max="1000" />
            <Input label="Latitude" id="locLat" name="locationLat" type="number" value={newLatitude} onChange={(e) => setNewLatitude(e.target.value)} placeholder="12.9716" />
            <Input label="Longitude" id="locLng" name="locationLng" type="number" value={newLongitude} onChange={(e) => setNewLongitude(e.target.value)} placeholder="77.5946" />
            <Input label="Address (optional)" id="locAddr" name="locationAddress" autoComplete="street-address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Street, City, State" />
            <Input label="Kiosk Unlock PIN (4-digit)" id="locKioskPin" name="locationKioskPin" value={newKioskPin} onChange={(e) => setNewKioskPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" maxLength={4} />
          </div>
          <div className="flex flex-wrap mt-4 gap-4">
            <Button variant="secondary" onClick={handleUseCurrentLocation} isLoading={isFetchingLocation} disabled={isFetchingLocation}>
              <Pin className="h-4 w-4 mr-2" /> Use Current Location
            </Button>
            {editingLocationId ? (
              <>
                <Button onClick={handleCreateLocation}>
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleCreateLocation}>
                <Plus className="h-4 w-4 mr-2" /> Add Location
              </Button>
            )}
          </div>
        </section>
        )}

        {/* Assign location to user */}
        {activeTab === 'Assign Location to User' && (
        <section className="bg-page border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-border">
            <h3 className="text-xl font-bold text-primary-text flex items-center">
              <UsersIcon className="h-6 w-6 mr-2 text-accent" /> Assign Location to User
            </h3>
            <p className="text-muted text-sm mt-1 ml-8">Map employees to specific geofenced locations.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-card p-5 rounded-lg border border-border/50">
                <Select label="Select Employee" id="assignUser" name="assignUser" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                  <option value="">-- Choose an Employee --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
                <div className="mt-4 text-xs text-muted leading-relaxed">
                  Select the employee you wish to assign locations to. You can assign multiple authorized locations for a single employee on the right.
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card p-5 rounded-lg border border-border/50 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="block text-sm font-semibold text-primary-text">Available Locations</p>
                  <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">{locations.length} total</span>
                </div>
                <div className="mb-3">
                  <Input 
                    id="assign-locations-search"
                    name="assignLocationsSearch"
                    placeholder="Search locations..." 
                    value={assignSearchTerm}
                    onChange={(e) => setAssignSearchTerm(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                  />
                </div>
                <div className="border border-border/80 rounded-lg p-2 h-64 overflow-y-auto bg-page shadow-inner">
                  {(() => {
                    const filteredLocations = locations.filter(loc => 
                      (loc.name || '').toLowerCase().includes(assignSearchTerm.toLowerCase()) || 
                      (loc.address || '').toLowerCase().includes(assignSearchTerm.toLowerCase())
                    );
                    
                    if (filteredLocations.length === 0) {
                      return (
                        <div className="h-full flex items-center justify-center text-muted text-sm italic">
                          No locations found.
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-1">
                        {filteredLocations.map((loc) => (
                        <label key={loc.id} className={`flex items-start gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${assignLocationIds.includes(loc.id) ? 'bg-accent/10 border border-accent/20' : 'hover:bg-muted/10 border border-transparent'}`}>
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              className="form-checkbox h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent"
                              checked={assignLocationIds.includes(loc.id)}
                              onChange={(e) => {
                                setAssignLocationIds((prev) => e.target.checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id));
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-primary-text truncate">{loc.name || 'Unnamed Site'}</div>
                            <div className="text-xs text-muted truncate mt-0.5">{loc.address || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-8 pt-4 border-t border-border">
            <Button onClick={handleAssignLocation} className="w-full sm:w-auto px-8" disabled={!assignUserId || assignLocationIds.length === 0}>
              <Save className="h-4 w-4 mr-2" /> Save Assignments
            </Button>
          </div>
        </section>
        )}

        {/* Existing locations list */}
        {activeTab === 'Existing Locations' && (
        <section>
          <h3 className="text-xl font-semibold text-primary-text mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-muted" /> Existing Locations ({locations.length})
          </h3>

          <div className="mb-4">
            <Input 
              id="locations-search"
              name="locationsSearch"
              placeholder="Search locations by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {locations.length === 0 ? (
            <p className="text-muted text-center md:text-left">No locations defined yet.</p>
          ) : (() => {
            let filteredLocations = locations.filter(loc => 
              searchTerm === '' || 
              (loc.name && loc.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (loc.address && loc.address.toLowerCase().includes(searchTerm.toLowerCase()))
            );

            filteredLocations = filteredLocations.sort((a, b) => {
              let aValue: any = '';
              let bValue: any = '';

              switch (sortField) {
                case 'name':
                  aValue = a.name || '';
                  bValue = b.name || '';
                  break;
                case 'radius':
                  aValue = a.radius || 0;
                  bValue = b.radius || 0;
                  break;
                case 'coordinates':
                  aValue = a.latitude || 0;
                  bValue = b.latitude || 0;
                  break;
                case 'address':
                  aValue = a.address || '';
                  bValue = b.address || '';
                  break;
                case 'kioskPin':
                  aValue = a.kioskPin || '';
                  bValue = b.kioskPin || '';
                  break;
                case 'createdBy':
                  aValue = a.createdByName || userMap.get(a.createdBy || '') || '';
                  bValue = b.createdByName || userMap.get(b.createdBy || '') || '';
                  break;
                case 'createdAt':
                  aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  break;
              }

              if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
              if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
              return 0;
            });

            const paginatedLocations = filteredLocations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

            return (
              <div className="space-y-4 md:space-y-0">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {paginatedLocations.map((loc) => (
                    <div key={loc.id} className="bg-card rounded-lg shadow-card p-4 border border-border">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-bold ${loc.name && duplicateNames.has(loc.name.trim().toLowerCase()) ? 'text-red-500' : 'text-primary-text'}`}>
                            {loc.name || 'Unnamed Location'}
                          </h4>
                          <p className="text-sm text-muted">{loc.address}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="text-blue-500 hover:text-blue-700 p-1" title="Edit" onClick={() => handleEditLocation(loc)}><Edit className="h-5 w-5" /></button>
                          <button type="button" className="p-2 hover:bg-red-500/10 rounded-full transition-colors" title="Delete" onClick={() => setDeleteLocationId(loc.id)}><Trash2 className="h-5 w-5 text-red-500" /></button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-muted">Radius</p><p>{loc.radius}m</p></div>
                        <div>
                          <p className="text-muted">Coordinates</p>
                          <p className={duplicateCoords.has(`${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`) ? "text-red-500 font-bold" : ""}>
                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                          </p>
                        </div>
                        <div><p className="text-muted">Kiosk PIN</p><p className="font-mono font-bold text-emerald-600">{loc.kioskPin || '1234'}</p></div>
                        <div><p className="text-muted">Created By</p><p>{loc.createdByName || userMap.get(loc.createdBy || '') || '-'}</p></div>
                        <div><p className="text-muted">Created At</p><p>{loc.createdAt ? new Date(loc.createdAt).toLocaleDateString() : '-'}</p></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto border border-border rounded-lg bg-page shadow-sm">
                  <table className="min-w-full border-collapse text-sm table-fixed">
                    <thead className="bg-muted/10 text-primary-text">
                      <tr>
                        {[
                          { field: 'name', label: 'Site Name', width: 'w-[18%]' },
                          { field: 'radius', label: 'Radius', width: 'w-[8%]' },
                          { field: 'coordinates', label: 'Coordinates', width: 'w-[12%]' },
                          { field: 'address', label: 'Address', width: 'w-[24%]' },
                          { field: 'kioskPin', label: 'Kiosk PIN', width: 'w-[10%]' },
                          { field: 'createdBy', label: 'Created By', width: 'w-[12%]' },
                          { field: 'createdAt', label: 'Created At', width: 'w-[12%]' }
                        ].map(({ field, label, width }) => (
                          <th 
                            key={field}
                            className={`p-3 border-b border-border text-left ${width} cursor-pointer hover:bg-muted/20 select-none group transition-colors`}
                            onClick={() => {
                              if (sortField === field) {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField(field as SortField);
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {label}
                              <div className="flex flex-col text-muted group-hover:text-primary-text transition-colors">
                                <ChevronUp className={`h-3 w-3 -mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-accent font-bold' : ''}`} />
                                <ChevronDown className={`h-3 w-3 ${sortField === field && sortDirection === 'desc' ? 'text-accent font-bold' : ''}`} />
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="p-3 border-b border-border text-center w-[6%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-page">
                      {paginatedLocations.map((loc) => (
                        <tr key={loc.id} className="border-b border-border hover:bg-muted/5 transition-colors group">
                          <td className={`p-3 font-medium break-words ${loc.name && duplicateNames.has(loc.name.trim().toLowerCase()) ? 'text-red-500' : 'text-primary-text'}`}>
                            {loc.name || '-'}
                          </td>
                          <td className="p-3 text-muted">{loc.radius}m</td>
                          <td className={`p-3 text-xs font-mono ${duplicateCoords.has(`${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`) ? 'text-red-500 font-bold' : 'text-muted'}`}>
                            {loc.latitude.toFixed(4)},<br/>{loc.longitude.toFixed(4)}
                          </td>
                          <td className={`p-3 text-xs break-words leading-relaxed ${loc.address && duplicateAddresses.has(loc.address.trim().toLowerCase()) ? 'text-red-500 font-bold' : 'text-muted'}`}>
                            {loc.address || '-'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-600">{loc.kioskPin || '1234'}</td>
                          <td className="p-3 text-muted truncate" title={loc.createdByName || userMap.get(loc.createdBy || '') || '-'}>
                            {loc.createdByName || userMap.get(loc.createdBy || '') || '-'}
                          </td>
                          <td className="p-3 text-muted text-xs">
                            {loc.createdAt ? (
                              <>
                                <div>{new Date(loc.createdAt).toLocaleDateString()}</div>
                                <div className="text-[10px] text-muted/70">{new Date(loc.createdAt).toLocaleTimeString()}</div>
                              </>
                            ) : '-'}
                          </td>
                          <td className="p-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button type="button" className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors" title="Edit" onClick={() => handleEditLocation(loc)}><Edit className="h-4 w-4" /></button>
                              <button type="button" className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors" title="Delete" onClick={() => setDeleteLocationId(loc.id)}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination 
                  currentPage={currentPage}
                  totalItems={filteredLocations.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  className="mt-4"
                />
              </div>
            );
          })()}
        </section>
        )}
      </div>

      <Modal
        isOpen={!!deleteLocationId}
        onClose={() => setDeleteLocationId(null)}
        title="Delete Location"
        onConfirm={() => deleteLocationId && handleDeleteLocation(deleteLocationId)}
        confirmButtonText="Yes, Delete Location"
        confirmButtonVariant="danger"
      >
        <p className="text-muted">
          Are you sure you want to delete this location? This will completely remove it from all users and the database. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default LocationManagement;