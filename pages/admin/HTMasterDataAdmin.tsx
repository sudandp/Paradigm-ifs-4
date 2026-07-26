import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Box, RefreshCw } from 'lucide-react';
import { HTMasterOption, HTMasterCategory } from '../../types/htYard';
import { htYardMasterDataService } from '../../services/htYardMasterDataService';
import toast from 'react-hot-toast';

export const HTMasterDataAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HTMasterCategory>('RMUMD');
  const [options, setOptions] = useState<HTMasterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('All');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<HTMasterOption>>({
    category: 'RMUMD',
    fieldKey: 'generic',
    optionValue: '',
    manufacturer: ''
  });

  const categories: HTMasterCategory[] = ['RMUMD', 'TRMaster Data', 'LTKMD', 'Cable Details'];

  useEffect(() => {
    setSearchQuery('');
    setSelectedFieldKey('All');
    setSelectedManufacturer('All');
    loadOptions();
  }, [activeTab]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const data = await htYardMasterDataService.getMasterOptions(activeTab);
      setOptions(data);
    } catch (error) {
      toast.error('Failed to load master options');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption.optionValue?.trim()) {
      toast.error('Option value is required');
      return;
    }

    try {
      await htYardMasterDataService.saveMasterOption({
        ...editingOption,
        category: activeTab
      });
      toast.success('Option saved successfully');
      setShowModal(false);
      loadOptions();
    } catch (error) {
      toast.error('Failed to save option');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      await htYardMasterDataService.deleteMasterOption(id);
      toast.success('Option removed');
      loadOptions();
    } catch (error) {
      toast.error('Failed to delete option');
    }
  };

  const uniqueFieldKeys = Array.from(new Set(options.map(opt => opt.fieldKey))).filter(Boolean).sort();
  const uniqueManufacturers = Array.from(new Set(options.map(opt => opt.manufacturer))).filter(Boolean).sort();

  const filteredOptions = options.filter(opt => {
    const matchesSearch = opt.optionValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opt.manufacturer && opt.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      opt.fieldKey.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFieldKey = selectedFieldKey === 'All' || opt.fieldKey === selectedFieldKey;
    const matchesManufacturer = selectedManufacturer === 'All' || opt.manufacturer === selectedManufacturer;

    return matchesSearch && matchesFieldKey && matchesManufacturer;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6 lg:p-10 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            HT Master Data
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filteredOptions.length} items
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
            Import
          </button>
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
            Export
          </button>
          <button
            onClick={() => {
              setEditingOption({ category: activeTab, fieldKey: 'mfr_name', optionValue: '', manufacturer: '' });
              setShowModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            New Option
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-4">
        {/* Search */}
        <div className="relative w-full xl:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search assets"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto pb-1 xl:pb-0 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <span>Category</span>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as HTMasterCategory)}
              className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer border-none p-0 pr-4"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
            <span>Field Target</span>
            <select
              value={selectedFieldKey}
              onChange={(e) => setSelectedFieldKey(e.target.value)}
              className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer border-none p-0 pr-4"
            >
              <option value="All">All Tags</option>
              {uniqueFieldKeys.map(fk => <option key={fk} value={fk}>{fk}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
            <span>Manufacturer</span>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer border-none p-0 pr-4"
            >
              <option value="All">All Custodians</option>
              {uniqueManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading options...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">No master options found for {activeTab}.</div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 w-12">
                  <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Category</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Tags</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Custodian</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredOptions.map((opt) => (
                <tr key={opt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                  <td className="px-4 py-4 w-12">
                    <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                        <Box className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {opt.optionValue}
                        <div className="flex items-center gap-1.5 mt-0.5 font-normal text-xs text-emerald-600 dark:text-emerald-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          Available
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400">
                      {activeTab}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {opt.fieldKey}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(opt.manufacturer || 'S')[0].toUpperCase()}
                      </div>
                      {opt.manufacturer || 'System'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingOption(opt);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(opt.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingOption.id ? 'Edit Master Option' : `Add Option to ${activeTab}`}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option Value *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schneider or 1R x 3C x 95 Sq. mm HT cable"
                  value={editingOption.optionValue || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, optionValue: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Field Target Key</label>
                <input
                  type="text"
                  placeholder="e.g. mfr_name, protection_relay"
                  value={editingOption.fieldKey || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, fieldKey: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Manufacturer Scope (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank for all vendors"
                  value={editingOption.manufacturer || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, manufacturer: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Save Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
