import React, { useEffect, useState, useMemo } from 'react';
import {
  Package, Plus, Search, Filter, AlertTriangle, ArrowUpRight,
  Boxes, RefreshCw, Trash2, Edit2, CheckCircle2, Building2, MapPin
} from 'lucide-react';
import { inventoryApi } from '../../services/inventoryApi';
import { api } from '../../services/api';
import type { InventoryItem, InventoryCategory } from '../../types/operations';
import toast from 'react-hot-toast';

const CATEGORIES: InventoryCategory[] = [
  'Electrical', 'Plumbing', 'HVAC', 'Cleaning', 'Civil', 'Security', 'General'
];

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [entities, setEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    entityId: '',
    itemCode: '',
    name: '',
    category: 'Electrical' as InventoryCategory,
    unitOfMeasure: 'Pcs',
    unitCost: 0,
    unitSellingPrice: 0,
    currentStock: 0,
    minReorderLevel: 10,
    location: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedItems, fetchedEntities] = await Promise.all([
        inventoryApi.getInventoryItems(),
        api.getEntities().catch(() => [])
      ]);
      setItems(fetchedItems);
      setEntities(fetchedEntities.map((e: any) => ({ id: e.id, name: e.name })));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      entityId: entities[0]?.id || '',
      itemCode: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: 'Electrical',
      unitOfMeasure: 'Pcs',
      unitCost: 0,
      unitSellingPrice: 0,
      currentStock: 0,
      minReorderLevel: 10,
      location: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      entityId: item.entityId || '',
      itemCode: item.itemCode,
      name: item.name,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure || 'Pcs',
      unitCost: item.unitCost || 0,
      unitSellingPrice: item.unitSellingPrice || 0,
      currentStock: item.currentStock || 0,
      minReorderLevel: item.minReorderLevel || 10,
      location: item.location || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      await inventoryApi.deleteInventoryItem(id);
      toast.success('Inventory item deleted');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      toast.error('Failed to delete item');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.itemCode.trim()) {
      toast.error('Item name and SKU code are required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingItem) {
        const updated = await inventoryApi.updateInventoryItem(editingItem.id, formData);
        toast.success('Inventory updated');
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
      } else {
        const created = await inventoryApi.createInventoryItem(formData);
        toast.success('Inventory item added');
        setItems(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to save inventory item');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedEntity !== 'all' && item.entityId !== selectedEntity) return false;
      if (showLowStockOnly && item.currentStock > item.minReorderLevel) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.itemCode.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.location && item.location.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, selectedCategory, selectedEntity, showLowStockOnly, searchQuery]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter(i => i.currentStock <= i.minReorderLevel).length;
    const totalValuation = items.reduce((acc, i) => acc + (i.currentStock * i.unitCost), 0);
    return { totalItems, lowStock, totalValuation };
  }, [items]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-7 w-7 text-emerald-600" />
            Spare Parts & Material Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage site stock levels, reorder alerts, and spare parts consumption for service requests.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20"
        >
          <Plus className="h-5 w-5" />
          Add Inventory Item
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total SKUs</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalItems}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-amber-600">{stats.lowStock}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Stock Valuation</p>
            <h3 className="text-2xl font-bold text-gray-900">₹{stats.totalValuation.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, item name, or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {entities.length > 0 && (
              <select
                value={selectedEntity}
                onChange={e => setSelectedEntity(e.target.value)}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Sites</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 border ${
                showLowStockOnly
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Low Stock Only
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading inventory items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-semibold text-gray-700">No inventory items found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or add a new stock SKU.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-bold text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Item Details</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4 text-right">Current Stock</th>
                  <th className="px-4 py-4 text-right">Unit Cost</th>
                  <th className="px-4 py-4 text-right">Stock Value</th>
                  <th className="px-4 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const isLowStock = item.currentStock <= item.minReorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[11px]">{item.itemCode}</span>
                          {item.entityName && <span>• {item.entityName}</span>}
                          {item.location && <span>• {item.location}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-700">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">
                        {item.currentStock} <span className="text-xs text-gray-400 font-normal">{item.unitOfMeasure}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium">
                        ₹{item.unitCost?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-gray-900">
                        ₹{((item.currentStock || 0) * (item.unitCost || 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LED Tube Light 20W"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.itemCode}
                    onChange={e => setFormData({ ...formData, itemCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unitOfMeasure}
                    onChange={e => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    placeholder="Pcs, Mtr, Ltr"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.currentStock}
                    onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minReorderLevel}
                    onChange={e => setFormData({ ...formData, minReorderLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none text-amber-600 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.unitCost}
                    onChange={e => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.unitSellingPrice}
                    onChange={e => setFormData({ ...formData, unitSellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {entities.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Assigned Site (Entity)</label>
                  <select
                    value={formData.entityId}
                    onChange={e => setFormData({ ...formData, entityId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Global / Unassigned</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Storage Location</label>
                <input
                  type="text"
                  placeholder="e.g. Block A Store Room"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
