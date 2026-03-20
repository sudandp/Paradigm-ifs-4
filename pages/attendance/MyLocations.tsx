import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { Location } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import { Pin, MapPin, Trash2, Edit, Search } from 'lucide-react';
import { reverseGeocode, getPrecisePosition } from '../../utils/locationUtils';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';


// Helper function to convert text to Title Case
const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * MyLocations component
 *
 * This page allows a logged in user to view their assigned locations.
 * Admin and HR can add/edit/delete all location fields.
 * Regular users can only edit the NAME of existing locations (coordinates are read-only).
 * Users must manually enter the location name.
 * "Use Current Location" button only fills coordinates and address.
 */
const MyLocations: React.FC = () => {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Self-selection state for users with no locations
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Check if user can manage locations (admin or HR)
  const canManageLocations = user && ['admin', 'hr', 'operation_manager'].includes(user.role);

  // Load user locations and all locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      if (!user) return;
      try {
        const [userLocs, allLocs] = await Promise.all([
          api.getUserLocations(user.id),
          api.getLocations()
        ]);
        setLocations(userLocs);
        setAllLocations(allLocs);
      } catch (err) {
        console.error(err);
        setToast({ message: 'Failed to load locations.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    loadLocations();
  }, [user]);

  // Handle name change with auto Title Case conversion
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Convert to Title Case as user types
    const titleCased = toTitleCase(value);
    setLocationName(titleCased);
  };

  const handleUseCurrentLocation = async () => {
    setAdding(true);
    setToast({ message: 'Acquiring your location, please wait...', type: 'success' });
    try {
      // Robust acquisition - getPrecisePosition now handles fallbacks internally
      const pos = await getPrecisePosition();
      const { latitude: lat, longitude: lon } = pos.coords;

      // Set coordinates
      setLatitude(lat.toString());
      setLongitude(lon.toString());

      // Attempt reverse geocoding for address ONLY (not name)
      try {
        const fetchedAddress = await reverseGeocode(lat, lon);
        setAddress(fetchedAddress);
      } catch (geocodeErr) {
        console.warn('Reverse geocode failed:', geocodeErr);
      }

      setToast({ message: 'Location acquired successfully! Please enter a location name.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.toLowerCase().includes('permission') 
        ? 'Location permission denied. Please enable it in settings.' 
        : 'Unable to acquire location fix. Please ensure GPS is on and you are in an open area.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleSelfAssign = async () => {
    if (!user || selectedLocationIds.length === 0) {
      setToast({ message: 'Please select at least one location.', type: 'error' });
      return;
    }

    setIsAssigning(true);
    try {
      // Assign all selected locations to the current user
      await Promise.all(
        selectedLocationIds.map(locationId =>
          api.assignLocationToUser(user.id, locationId)
        )
      );

      setToast({ message: 'Locations assigned successfully!', type: 'success' });
      setSelectedLocationIds([]);

      // Refresh user locations
      const userLocs = await api.getUserLocations(user.id);
      setLocations(userLocs);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to assign locations.', type: 'error' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleLocationToggle = (locationId: string) => {
    setSelectedLocationIds(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Only admins can ADD new locations. Everyone can EDIT existing ones (name only for regular users).
    if (!editingLocationId && !canManageLocations) {
      setToast({ message: 'You do not have permission to add locations.', type: 'error' });
      return;
    }

    // Validation
    if (!locationName.trim()) {
      setToast({ message: 'Please enter a location name.', type: 'error' });
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      setToast({ message: 'Please provide valid coordinates.', type: 'error' });
      return;
    }

    // Check for duplicate by name (case-insensitive)
    const duplicateName = allLocations.find(
      loc => loc.id !== editingLocationId &&
        loc.name?.toLowerCase() === locationName.toLowerCase()
    );

    if (duplicateName) {
      setToast({ message: `Location "${locationName}" already exists. Please use a different name.`, type: 'error' });
      return;
    }

    // Check for duplicate by coordinates (within 10 meters)
    if (!editingLocationId) {
      const duplicateCoords = allLocations.find(loc => {
        const distance = calculateDistance(lat, lon, loc.latitude, loc.longitude);
        return distance < 10;
      });

      if (duplicateCoords) {
        const locName = duplicateCoords.name || duplicateCoords.address || 'Unnamed Location';
        setToast({ message: `A location already exists at these coordinates: "${locName}".`, type: 'error' });
        return;
      }
    }

    setAdding(true);
    try {
      const defaultRadius = 100;

      if (editingLocationId) {
        // Update existing location
        await api.updateLocation(editingLocationId, {
          name: locationName,
          latitude: lat,
          longitude: lon,
          radius: defaultRadius,
          address: address || null,
        });
        setToast({ message: 'Location updated successfully.', type: 'success' });
      } else {
        // Create new location
        const newLoc = await api.createLocation({
          name: locationName,
          latitude: lat,
          longitude: lon,
          radius: defaultRadius,
          address: address || null,
          createdBy: user.id,
        });

        // Assign to current user
        await api.assignLocationToUser(user.id, newLoc.id);

        setToast({ message: 'Location added successfully.', type: 'success' });
      }

      // Refresh locations
      const [userLocs, allLocs] = await Promise.all([
        api.getUserLocations(user.id),
        api.getLocations()
      ]);
      setLocations(userLocs);
      setAllLocations(allLocs);

      // Reset form
      resetForm();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to save location.', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (loc: Location) => {
    // All users can edit (but regular users can only change the name)
    setEditingLocationId(loc.id);
    setLocationName(loc.name || '');
    setLatitude(loc.latitude.toString());
    setLongitude(loc.longitude.toString());
    setAddress(loc.address || '');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (locId: string) => {
    if (!user || !canManageLocations) {
      setToast({ message: 'You do not have permission to delete locations.', type: 'error' });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this location? It will be removed from all users.')) {
      return;
    }

    try {
      await api.deleteLocation(locId);
      setToast({ message: 'Location deleted successfully.', type: 'success' });

      // Refresh locations
      const [userLocs, allLocs] = await Promise.all([
        api.getUserLocations(user.id),
        api.getLocations()
      ]);
      setLocations(userLocs);
      setAllLocations(allLocs);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to delete location.', type: 'error' });
    }
  };

  const resetForm = () => {
    setLocationName('');
    setLatitude('');
    setLongitude('');
    setAddress('');
    setEditingLocationId(null);
  };

  // Filter unique locations by address for display (show only one entry per unique address)
  const uniqueLocations = locations.filter((loc, index, self) => {
    if (!loc.address) return true;
    return index === self.findIndex((t) => t.address === loc.address);
  });

  if (loading) {
      return <LoadingScreen message="Loading page data..." />;
  }

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <MapPin className="h-6 w-6 mr-2" /> My Locations
        </h2>
        <p className="text-muted mb-6">
          These are the geofenced locations assigned to you. You may punch in/out only when
          within one of these locations. {canManageLocations ? 'Use the form below to add a new location.' : 'You can edit location names by clicking the edit button.'}
        </p>

        {/* Add/Edit Location Form */}
        {/* Admin/HR can add new and edit all fields. Regular users can only edit NAME when editing existing locations */}
        {(canManageLocations || editingLocationId) && (
          <div className="bg-gray-50 border border-border rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingLocationId ? 'Edit Location' : 'Add New Location'}
            </h3>

            {/* Note: Regular users can ONLY edit the Name. Latitude, Longitude, and Address are disabled for non-admins. */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="Location Name (required) *"
                id="locationName"
                value={locationName}
                onChange={handleNameChange}
                placeholder="e.g. Office HQ"
                autoComplete="off"
                required
              />
              <Input
                label="Latitude"
                id="latitude"
                type="number"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="12.9716"
                step="any"
                autoComplete="off"
                disabled={editingLocationId && !canManageLocations}
              />
              <Input
                label="Longitude"
                id="longitude"
                type="number"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="77.5946"
                step="any"
                autoComplete="off"
                disabled={editingLocationId && !canManageLocations}
              />
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, State"
                autoComplete="street-address"
                disabled={editingLocationId && !canManageLocations}
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              {canManageLocations && (
                <Button onClick={handleUseCurrentLocation} variant="secondary" isLoading={adding} disabled={adding}>
                  <Pin className="h-4 w-4 mr-2" /> Use Current Location
                </Button>
              )}
              <Button onClick={handleSubmit} isLoading={adding} disabled={adding || !locationName.trim()}>
                {editingLocationId ? 'Save Changes' : 'Add Location'}
              </Button>
              {editingLocationId && (
                <Button onClick={resetForm} variant="secondary">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <p>Loading locations...</p>
        ) : locations.length === 0 ? (
          <div>
            {canManageLocations ? (
              <p className="text-muted text-center md:text-left">
                No locations assigned. Use the form above to add one.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Select Your Locations</h3>
                  <p className="text-sm text-blue-800 mb-4">
                    You don't have any locations assigned yet. Please select the locations where you'll be working from the list below.
                  </p>
                </div>

                {allLocations.length === 0 ? (
                  <p className="text-muted text-center">No locations available. Contact your administrator.</p>
                ) : (
                  <div>
                    <div className="mb-4">
                      <Input
                        type="text"
                        placeholder="Search by name or address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {allLocations
                        .filter(loc =>
                          searchTerm === '' ||
                          loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((loc) => (
                          <div
                            key={loc.id}
                            onClick={() => handleLocationToggle(loc.id)}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedLocationIds.includes(loc.id)
                              ? 'border-accent bg-accent/10 shadow-md'
                              : 'border-border hover:border-accent/50 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-start">
                              <input
                                type="checkbox"
                                checked={selectedLocationIds.includes(loc.id)}
                                onChange={() => { }}
                                className="mt-1 mr-3 h-5 w-5 text-accent rounded focus:ring-accent"
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-semibold text-primary-text">{loc.name || 'Unnamed Location'}</h4>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(loc);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                    title="Edit Name"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                </div>
                                <p className="text-sm text-muted mt-1">{loc.address || 'No address'}</p>
                                <p className="text-xs text-muted mt-2">
                                  Coordinates: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} • Radius: {loc.radius}m
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="flex justify-center">
                      <Button
                        onClick={handleSelfAssign}
                        isLoading={isAssigning}
                        disabled={isAssigning || selectedLocationIds.length === 0}
                      >
                        {selectedLocationIds.length === 0
                          ? 'Select Locations Above'
                          : `Assign ${selectedLocationIds.length} Location${selectedLocationIds.length > 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Input 
                placeholder="Search locations by name or address..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="h-4 w-4" />}
                autoComplete="off"
              />
            </div>

            {(() => {
              const filteredLocations = uniqueLocations.filter(loc => 
                searchTerm === '' || 
                (loc.name && loc.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (loc.address && loc.address.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              const paginatedLocations = filteredLocations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              return (
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-1 md:gap-4">
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {paginatedLocations.map((loc) => (
                      <div key={loc.id} className="bg-card rounded-lg shadow-card p-4 border border-border">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-primary-text">{loc.name || loc.address || 'Unnamed Location'}</h3>
                            <p className="text-sm text-muted">{loc.address}</p>
                          </div>
                          <div className="flex gap-2">
                            {/* All users can edit name */}
                            <button
                              type="button"
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title={canManageLocations ? "Edit Location" : "Edit Name"}
                              onClick={() => handleEdit(loc)}
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            {/* Only admin/HR can delete */}
                            {canManageLocations && (
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete Location"
                                onClick={() => handleDelete(loc.id)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted">Radius</p>
                            <p>{loc.radius}m</p>
                          </div>
                          <div>
                            <p className="text-muted">Coordinates</p>
                            <p>{loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto border border-border rounded-lg">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-page text-primary-text">
                        <tr>
                          <th className="p-3 border-b border-border text-left">Name</th>
                          <th className="p-3 border-b border-border text-left">Radius (m)</th>
                          <th className="p-3 border-b border-border text-left">Coordinates</th>
                          <th className="p-3 border-b border-border text-left">Address</th>
                          <th className="p-3 border-b border-border text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLocations.map((loc) => (
                          <tr key={loc.id} className="border-b border-border">
                            <td className="p-3">{loc.name || '-'}</td>
                            <td className="p-3">{loc.radius}</td>
                            <td className="p-3">{loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}</td>
                            <td className="p-3">{loc.address || '-'}</td>
                            <td className="p-3 flex gap-2">
                              {/* All users can edit name */}
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800"
                                title={canManageLocations ? "Edit Location" : "Edit Name"}
                                onClick={() => handleEdit(loc)}
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              {/* Only admin/HR can delete */}
                              {canManageLocations && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete Location"
                                  onClick={() => handleDelete(loc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
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
          </>
        )}
      </div>
    </div>
  );
};

export default MyLocations;