import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Car, Search, Edit, Trash2, Camera, Plus, RotateCw } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { format } from 'date-fns';

export default function UserVehiclesManagement() {
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [vehicleToDelete, setVehicleToDelete] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchVehicles = async () => {
        setIsLoading(true);
        try {
            const data = await api.getAllUserVehicles();
            setVehicles(data);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
            Toast.error('Failed to load vehicles');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    const handleDeleteClick = (vehicle: any) => {
        setVehicleToDelete(vehicle);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!vehicleToDelete) return;
        try {
            await api.deleteUserVehicle(vehicleToDelete.id);
            Toast.success('Vehicle deleted successfully');
            setVehicles(prev => prev.filter(v => v.id !== vehicleToDelete.id));
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            Toast.error('Failed to delete vehicle');
        } finally {
            setIsDeleteModalOpen(false);
            setVehicleToDelete(null);
        }
    };

    const filteredVehicles = vehicles.filter(v => 
        v.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.users?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.users?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <LoadingScreen message="Loading User Vehicles..." />;

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full pb-32 lg:pb-8">
            <AdminPageHeader 
                title="User Vehicles" 
                subtitle="Manage employee vehicle and bike details"
                icon={<Car className="h-6 w-6 text-emerald-500" />}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="relative w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Search by user or make..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                        />
                        <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                    <Button onClick={fetchVehicles} variant="outline" className="gap-2">
                        <RotateCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>

                {isMobile ? (
                    <div className="p-4 space-y-4 bg-slate-50">
                        {filteredVehicles.map(vehicle => (
                            <div key={vehicle.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="flex items-center gap-3 mb-3">
                                    {vehicle.users?.avatar_url ? (
                                        <img src={vehicle.users.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold uppercase">
                                            {vehicle.users?.first_name?.[0]}{vehicle.users?.last_name?.[0]}
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-slate-800">{vehicle.users?.first_name} {vehicle.users?.last_name}</div>
                                        <div className="text-xs text-slate-500">{format(new Date(vehicle.created_at), 'dd MMM yyyy, hh:mm a')}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Make/Model</div>
                                        <div className="font-semibold text-slate-700 text-sm">{vehicle.brand_name || 'N/A'}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Type</div>
                                        <div className="font-semibold text-slate-700 text-sm capitalize">{vehicle.vehicle_type?.replace('_', ' ') || 'N/A'}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Engine CC</div>
                                        <div className="font-semibold text-slate-700 text-sm">{vehicle.engine_cc ? `${vehicle.engine_cc}cc` : 'N/A'}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Odometer</div>
                                        <div className="font-semibold text-slate-700 text-sm">{vehicle.odometer_reading ? `${vehicle.odometer_reading} KM` : 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    {vehicle.odometer_picture_url && (
                                        <button 
                                            onClick={() => setPreviewImage(vehicle.odometer_picture_url)}
                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                                        >
                                            <Camera className="h-5 w-5" />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleDeleteClick(vehicle)}
                                        className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredVehicles.length === 0 && (
                            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
                                No vehicles found.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold border-y border-slate-200">
                                    <th className="p-4 font-semibold">User</th>
                                    <th className="p-4 font-semibold">Make/Model</th>
                                    <th className="p-4 font-semibold">Type & CC</th>
                                    <th className="p-4 font-semibold">Odometer</th>
                                    <th className="p-4 font-semibold">Image</th>
                                    <th className="p-4 font-semibold">Updated</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredVehicles.map(vehicle => (
                                    <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {vehicle.users?.avatar_url ? (
                                                    <img src={vehicle.users.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold uppercase text-xs">
                                                        {vehicle.users?.first_name?.[0]}{vehicle.users?.last_name?.[0]}
                                                    </div>
                                                )}
                                                <div className="font-semibold text-slate-800">{vehicle.users?.first_name} {vehicle.users?.last_name}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium text-slate-700">{vehicle.brand_name || '-'}</td>
                                        <td className="p-4">
                                            <div className="capitalize">{vehicle.vehicle_type?.replace('_', ' ') || '-'}</div>
                                            <div className="text-xs text-slate-500">{vehicle.engine_cc ? `${vehicle.engine_cc}cc` : ''}</div>
                                        </td>
                                        <td className="p-4 font-mono text-slate-600">{vehicle.odometer_reading ? `${vehicle.odometer_reading} KM` : '-'}</td>
                                        <td className="p-4">
                                            {vehicle.odometer_picture_url ? (
                                                <button 
                                                    onClick={() => setPreviewImage(vehicle.odometer_picture_url)}
                                                    className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors cursor-pointer"
                                                >
                                                    <img src={vehicle.odometer_picture_url} className="w-full h-full object-cover" alt="Odometer" />
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 text-xs">No image</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-500 text-xs">
                                            {format(new Date(vehicle.created_at), 'dd MMM yyyy')}
                                            <div className="text-[10px] text-slate-400">{format(new Date(vehicle.created_at), 'hh:mm a')}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleDeleteClick(vehicle)}
                                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredVehicles.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No vehicles found.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Vehicle"
            >
                <div className="p-6 text-center">
                    <Trash2 className="h-12 w-12 text-rose-500 mx-auto mb-4 opacity-80" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Vehicle Record?</h3>
                    <p className="text-slate-500 mb-6">Are you sure you want to delete this vehicle record? This action cannot be undone.</p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete}>Delete</Button>
                    </div>
                </div>
            </Modal>

            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
                        <img src={previewImage} alt="Odometer Full Preview" className="w-full h-full object-contain max-h-[90vh]" />
                        <button 
                            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all flex items-center justify-center h-10 w-10"
                            onClick={() => setPreviewImage(null)}
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
