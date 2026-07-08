import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Building,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Plus,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
  Eye,
  Calendar,
  User as UserIcon,
  History,
  Clock,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { opsApi } from '../../services/opsApi';
import { api } from '../../services/api';
import type { SnagEntry, Criticality, PurposeOfVisit, Department } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CRITICALITY_COLOR: Record<Criticality, string> = {
  High: 'text-red-600 bg-red-50 border-red-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Low: 'text-green-600 bg-green-50 border-green-200',
};

const STATUS_COLOR: Record<string, string> = {
  Open: 'text-red-600 bg-red-50',
  'In Progress': 'text-amber-600 bg-amber-50',
  Resolved: 'text-green-600 bg-green-50',
};

function generateId() {
  return `snag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Parse Excel-style CSV exported from Google Sheets
function parseExcelData(text: string): SnagEntry[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // skip header row
  return lines.slice(1).map((line, i) => {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    return {
      id: generateId(),
      timestamp: cols[0] || new Date().toISOString(),
      emailAddress: cols[1] || '',
      nameOfSite: cols[2] || '',
      purposeOfVisit: (cols[3] ? [cols[3] as PurposeOfVisit] : []),
      department: (cols[4] ? [cols[4] as Department] : []),
      snagPictureUrl: cols[5] || '',
      criticality: (cols[6] as Criticality) || 'Low',
      snagDescription: cols[7] || '',
      actionToBeTaken: cols[8] || '',
      remarks: cols[9] || '',
      status: 'Open',
      submittedBy: cols[1] || '',
    };
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const CriticalityBadge: React.FC<{ value: Criticality }> = ({ value }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${CRITICALITY_COLOR[value]}`}>
    <AlertTriangle size={10} />
    {value}
  </span>
);

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[value] ?? 'text-gray-600 bg-gray-50'}`}>
    {value}
  </span>
);

// ─── New Snag Form ────────────────────────────────────────────────────────────

interface SnagFormProps {
  initialData?: SnagEntry;
  onSave: (entry: SnagEntry, file?: File) => void;
  onCancel: () => void;
}

const SnagForm: React.FC<SnagFormProps> = ({ initialData, onSave, onCancel }) => {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    nameOfSite: initialData?.nameOfSite || '',
    purposeOfVisit: initialData?.purposeOfVisit || ([] as PurposeOfVisit[]),
    department: initialData?.department || ([] as Department[]),
    criticality: initialData?.criticality || 'Medium' as Criticality,
    snagDescription: initialData?.snagDescription || '',
    actionToBeTaken: initialData?.actionToBeTaken || '',
    remarks: initialData?.remarks || '',
    snagPictureName: initialData?.snagPictureUrl?.split('/').pop() || '',
    snagPictureUrl: initialData?.snagPictureUrl || '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.snagPictureUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleCheckbox = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      setImagePreview(ev.target?.result as string);
      setForm(f => ({ ...f, snagPictureName: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameOfSite || !form.snagDescription || !form.actionToBeTaken) {
      toast.error('Please fill all required fields');
      return;
    }
    const entry: SnagEntry = {
      id: initialData?.id || generateId(),
      timestamp: initialData?.timestamp || new Date().toISOString(),
      emailAddress: initialData?.emailAddress || user?.email || '',
      ...form,
      status: initialData?.status || 'Open',
      submittedBy: initialData?.submittedBy || user?.name || user?.email || '',
    };
    onSave(entry, selectedFile || undefined);
  };

  const purposeOptions: PurposeOfVisit[] = ['Monthly Audit', 'Quarterly Audit', 'Breakdown Visit', 'Training', 'Other'];
  const departmentOptions: Department[] = ['MEP', 'House Keeping', 'Security', 'Landscaping', 'Fire and Safety', 'Other'];
  const criticalityOptions: Criticality[] = ['High', 'Medium', 'Low'];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Site Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Name of the Site <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.nameOfSite}
          onChange={e => setForm(f => ({ ...f, nameOfSite: e.target.value }))}
          placeholder="Enter site name"
        />
      </div>

      {/* Purpose of Visit */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Purpose of Visit <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {purposeOptions.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.purposeOfVisit.includes(opt)}
                onChange={() => setForm(f => ({ ...f, purposeOfVisit: toggleCheckbox(f.purposeOfVisit, opt) }))}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-teal-700 transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Department */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Department <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {departmentOptions.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.department.includes(opt)}
                onChange={() => setForm(f => ({ ...f, department: toggleCheckbox(f.department, opt) }))}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-teal-700 transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Attach Snag Picture */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Attach Snag Picture <span className="text-red-500">*</span>
        </label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all"
        >
          {imagePreview ? (
            <div className="relative">
              {imagePreview.startsWith('data:image/') || imagePreview.startsWith('http') ? (
                <img src={imagePreview} alt="Snag" className="max-h-40 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 bg-teal-50 rounded-lg max-w-[200px] mx-auto border border-teal-100">
                  <FileSpreadsheet size={32} className="text-teal-600 mb-2" />
                  <span className="text-xs text-teal-800 font-medium">Document Attached</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">{form.snagPictureName}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Camera size={28} />
              <p className="text-sm font-medium">Click to add file</p>
              <p className="text-xs">JPG, PNG, PDF supported</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
      </div>

      {/* Criticality */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Criticality <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {criticalityOptions.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="criticality"
                checked={form.criticality === opt}
                onChange={() => setForm(f => ({ ...f, criticality: opt }))}
                className="w-4 h-4 border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className={`text-sm font-medium ${opt === 'High' ? 'text-red-600' : opt === 'Medium' ? 'text-amber-600' : 'text-green-600'}`}>
                {opt}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Snag Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Snag Description <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.snagDescription}
          onChange={e => setForm(f => ({ ...f, snagDescription: e.target.value }))}
          placeholder="Describe the snag in detail"
        />
      </div>

      {/* Action To Be Taken */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Action To Be Taken <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.actionToBeTaken}
          onChange={e => setForm(f => ({ ...f, actionToBeTaken: e.target.value }))}
          placeholder="Describe the action to be taken..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 resize-none transition-all placeholder-gray-400"
        />
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Remarks
        </label>
        <Input
          value={form.remarks || ''}
          onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          placeholder="Additional remarks (optional)"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          <Plus size={15} />
          Add Snag Entry
        </Button>
      </div>
    </form>
  );
};

// ─── Detail View ─────────────────────────────────────────────────────────────

const SnagDetailView: React.FC<{ entry: SnagEntry; onBack: () => void; onStatusChange: (id: string, status: SnagEntry['status']) => void; canEdit?: boolean }> = ({
  entry,
  onBack,
  onStatusChange,
  canEdit = true,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'log'>('details');
  const statusOptions: SnagEntry['status'][] = ['Open', 'In Progress', 'Resolved'];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onBack}
        className="flex items-center text-sm text-gray-500 hover:text-teal-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 w-fit"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back to Audit List
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-500 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{entry.nameOfSite}</h2>
              <p className="text-teal-100 text-sm mt-1">{format(new Date(entry.timestamp), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <CriticalityBadge value={entry.criticality} />
            <StatusBadge value={entry.status} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5 pt-3">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'details' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Info size={16} /> Details
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`ml-6 pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'log' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={16} /> Audit Log
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {activeTab === 'details' ? (
            <>
              {entry.snagPictureUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <img src={entry.snagPictureUrl} alt="Snag" className="w-full object-cover max-h-48" />
            </div>
          )}

          <InfoRow icon={<MapPin size={14} />} label="Site" value={entry.nameOfSite} />
          <InfoRow icon={<UserIcon size={14} />} label="Submitted By" value={entry.submittedBy || entry.emailAddress} />
          <InfoRow icon={<Calendar size={14} />} label="Visit Purpose" value={entry.purposeOfVisit.join(', ')} />
          <InfoRow icon={<Building size={14} />} label="Department" value={entry.department.join(', ')} />

          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Snag Description</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">{entry.snagDescription}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Action To Be Taken</p>
            <p className="text-sm text-gray-800 bg-amber-50 rounded-lg p-3 border border-amber-100">{entry.actionToBeTaken}</p>
          </div>

          {entry.remarks && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Remarks</p>
              <p className="text-sm text-gray-800 bg-blue-50 rounded-lg p-3 border border-blue-100">{entry.remarks}</p>
            </div>
          )}

          {/* Status change */}
          {canEdit && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Update Status</label>
              <div className="flex gap-2">
                {statusOptions.map(s => (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(entry.id, s); onBack(); }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                      entry.status === s
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
          ) : (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm text-teal-600 border border-gray-100">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Snag Created</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entry.createdAt ? format(new Date(entry.createdAt), 'dd MMM yyyy, hh:mm:ss a') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm text-amber-600 border border-gray-100">
                  <History size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Last Updated</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entry.updatedAt ? format(new Date(entry.updatedAt), 'dd MMM yyyy, hh:mm:ss a') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2">
    <div className="text-teal-500 mt-0.5">{icon}</div>
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || '—'}</p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SnagAuditPage: React.FC = () => {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<SnagEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SnagEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SnagEntry | null>(null);
  const [search, setSearch] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await opsApi.getSnagEntries();
      if (data.length > 0) {
        setEntries(data);
      } else {
        // Default fallback mock entry
        setEntries([
          {
            id: 'sample-1',
            timestamp: '2024-09-26T13:38:19.000Z',
            emailAddress: 'nithingowda2807@gmail.com',
            nameOfSite: 'Sark 2 Villas',
            purposeOfVisit: ['Monthly Audit'],
            department: ['Security'],
            snagPictureUrl: '',
            criticality: 'High',
            snagDescription: 'Compound wall height is less and there is no solar fencing in west line',
            actionToBeTaken: 'Solar fencing needs to be installed at boundary wall near west line. Anyone can cross the boundary wall from Fakeers or Sark 1 land. It\'s location is reflecting high chances for people entry.',
            remarks: 'Need to close the gate after inspection',
            status: 'Open',
            submittedBy: 'Nithin Gowda',
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load snag entries:', err);
      toast.error('Failed to fetch snag entries from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    
    // Fetch users for manager validation
    api.getUsers({ fetchAll: true }).then(data => {
      if (Array.isArray(data)) setUsers(data);
      else if (data && Array.isArray(data.users)) setUsers(data.users);
    }).catch(console.error);
  }, [fetchEntries]);

  const canDelete = useCallback((entry: SnagEntry) => {
    return ['admin', 'super_admin', 'developer'].includes(user?.role || '');
  }, [user]);

  const canEdit = useCallback((entry: SnagEntry) => {
    if (['admin', 'super_admin', 'developer'].includes(user?.role || '')) return true;
    if (user?.email === entry.emailAddress) return true;
    
    const uploader = users.find(u => u.email === entry.emailAddress);
    if (uploader) {
       const managerIds = [uploader.reportingManagerId, uploader.reportingManager2Id, uploader.reportingManager3Id];
       if (managerIds.includes(user?.id)) return true;
    }
    return false;
  }, [user, users]);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || e.nameOfSite.toLowerCase().includes(q)
      || e.snagDescription.toLowerCase().includes(q)
      || (e.submittedBy || '').toLowerCase().includes(q);
    const matchCrit = !filterCriticality || e.criticality === filterCriticality;
    const matchDept = !filterDept || e.department.includes(filterDept as Department);
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchSearch && matchCrit && matchDept && matchStatus;
  });

  const stats = {
    total: entries.length,
    high: entries.filter(e => e.criticality === 'High').length,
    open: entries.filter(e => e.status === 'Open').length,
    resolved: entries.filter(e => e.status === 'Resolved').length,
  };

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const text = ev.target?.result as string;
      const parsed = parseExcelData(text);
      if (parsed.length === 0) {
        toast.error('No data found. Make sure the file is tab-separated (exported from Google Sheets).');
      } else {
        try {
          let count = 0;
          for (const item of parsed) {
            const { id, ...saveItem } = item;
            await opsApi.saveSnagEntry(saveItem);
            count++;
          }
          toast.success(`${count} snag entries imported successfully`);
          fetchEntries();
        } catch (err) {
          console.error('Failed to save imported entries:', err);
          toast.error('Failed to save some imported snag entries.');
          setEntries(prev => [...parsed, ...prev]);
        }
      }
      setImporting(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [fetchEntries]);

  const handleStatusChange = useCallback(async (id: string, status: SnagEntry['status']) => {
    if (id.startsWith('sample-')) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      toast.success('Mock status updated locally');
      return;
    }
    try {
      await opsApi.updateSnagStatus(id, status);
      toast.success('Status updated successfully');
      fetchEntries();
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status in database.');
    }
  }, [fetchEntries]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this snag entry?')) return;
    if (id.startsWith('sample-')) {
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Mock entry deleted locally');
      return;
    }
    try {
      await opsApi.deleteSnagEntry(id);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (err) {
      console.error('Failed to delete snag:', err);
      toast.error('Failed to delete snag from database.');
    }
  }, [fetchEntries]);

  const exportCSV = () => {
    const headers = ['Timestamp', 'Email', 'Site Name', 'Purpose of Visit', 'Department', 'Snag Picture', 'Criticality', 'Snag Description', 'Action To Be Taken', 'Remarks', 'Status', 'Submitted By'];
    const rows = filtered.map(e => [
      format(new Date(e.timestamp), 'dd/MM/yyyy HH:mm'),
      e.emailAddress,
      e.nameOfSite,
      e.purposeOfVisit.join('; '),
      e.department.join('; '),
      e.snagPictureUrl ? 'Attached' : '',
      e.criticality,
      e.snagDescription,
      e.actionToBeTaken,
      e.remarks || '',
      e.status,
      e.submittedBy || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SnagAudit_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as CSV');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-accent" />
            Snag Audit
          </h1>
          <p className="text-muted mt-1">Site inspection & defect tracking</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <>
              <Button
                variant="outline"
                onClick={() => importRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <FileSpreadsheet size={15} className="mr-1.5" />}
                Import Excel
              </Button>
              <input ref={importRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleImport} />
            </>
          )}
          <Button
            variant="outline"
            onClick={exportCSV}
          >
            <Download size={15} className="mr-1.5" />
            Export CSV
          </Button>
          <Button
            onClick={() => setShowForm(true)}
          >
            <Plus size={15} className="mr-1.5" />
            New Snag
          </Button>
        </div>
      </div>

      {selectedEntry ? (
        <SnagDetailView
          entry={selectedEntry}
          onBack={() => setSelectedEntry(null)}
          onStatusChange={handleStatusChange}
          canEdit={canEdit(selectedEntry)}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Snags', value: stats.total, textColor: 'text-primary-text' },
          { label: 'High Criticality', value: stats.high, textColor: 'text-red-600' },
          { label: 'Open Issues', value: stats.open, textColor: 'text-amber-600' },
          { label: 'Resolved', value: stats.resolved, textColor: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-4 text-center border border-border shadow-card transition-all hover:shadow-md">
            <div className={`text-3xl font-black ${s.textColor}`}>{s.value}</div>
            <div className="text-muted text-xs font-semibold uppercase tracking-wider mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search site, description…"
              autoCapitalizeCustom={false}
              icon={<Search size={16} />}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-auto min-w-[160px]">
            <Select
              id="filter-criticality"
              value={filterCriticality}
              onChange={e => setFilterCriticality(e.target.value)}
              className="w-full"
            >
              <option value="">All Criticality</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[180px]">
            <Select
              id="filter-dept"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full"
            >
              <option value="">All Departments</option>
              <option>MEP</option>
              <option>House Keeping</option>
              <option>Security</option>
              <option>Landscaping</option>
              <option>Fire and Safety</option>
            </Select>
          </div>
          <div className="w-full md:w-auto min-w-[160px]">
            <Select
              id="filter-status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full"
            >
              <option value="">All Status</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>Resolved</option>
            </Select>
          </div>
          {(search || filterCriticality || filterDept || filterStatus) && (
            <Button
              variant="outline"
              onClick={() => { setSearch(''); setFilterCriticality(''); setFilterDept(''); setFilterStatus(''); }}
              className="text-xs border-red-500/20 text-red-500 hover:bg-red-50/50 flex items-center gap-1.5 h-11"
            >
              <X size={14} /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Import hint */}
      {user?.role === 'admin' && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-start gap-3 text-sm text-primary-text">
          <FileSpreadsheet size={18} className="shrink-0 mt-0.5 text-accent" />
          <div>
            <strong className="text-accent-dark">Import from Google Form Excel:</strong> Download your Google Sheets response file as TSV (Tab-separated) and use "Import Excel" button to load all snag entries automatically.
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-teal-600 gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading snag entries from database...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ClipboardCheck size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No snag entries found</p>
              <p className="text-sm mt-1">Add a new snag or import from Excel</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Timestamp', 'Site Name', 'Department', 'Criticality', 'Snag Description', 'Action', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {format(new Date(entry.timestamp), 'dd/MM/yy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{entry.nameOfSite}</div>
                        <div className="text-xs text-gray-400">{entry.purposeOfVisit[0] || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{entry.department.join(', ')}</td>
                      <td className="px-4 py-3">
                        <CriticalityBadge value={entry.criticality} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <p className="line-clamp-2">{entry.snagDescription}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        <p className="line-clamp-2 text-xs">{entry.actionToBeTaken}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={entry.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1.5 hover:bg-teal-50 text-gray-400 hover:text-teal-600 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          {canEdit(entry) && (
                            <button
                              onClick={() => {
                                setEditingEntry(entry);
                                setShowForm(true);
                              }}
                              className="p-1.5 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded-lg transition-colors"
                              title="Edit snag"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDelete(entry) && (
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              Showing {filtered.length} of {entries.length} entries
            </div>
          )}
        </div>
      </>
      )}

      {/* New Snag Slide-in Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="w-full max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="bg-gradient-to-r from-teal-700 to-teal-500 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} />
                  <h2 className="font-bold">New Snag Entry</h2>
                </div>
                <button onClick={() => { setShowForm(false); setEditingEntry(null); }} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-5">
              {isSaving ? (
                <div className="flex flex-col items-center justify-center py-20 text-teal-600 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm font-semibold">Saving snag & uploading image...</p>
                </div>
              ) : (
                <SnagForm
                  initialData={editingEntry || undefined}
                  onSave={async (entry, file) => {
                    setIsSaving(true);
                    try {
                      await opsApi.saveSnagEntry(entry, file);
                      toast.success(editingEntry ? 'Snag entry updated' : 'Snag entry saved successfully');
                      setShowForm(false);
                      setEditingEntry(null);
                      fetchEntries();
                    } catch (err) {
                      console.error('Failed to save snag entry:', err);
                      toast.error('Failed to save snag to database.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  onCancel={() => { setShowForm(false); setEditingEntry(null); }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnagAuditPage;
