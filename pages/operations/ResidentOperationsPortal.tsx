import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Ticket, 
  Activity, 
  PhoneCall, 
  Building2, 
  User, 
  ArrowLeftRight, 
  ShieldCheck, 
  Sparkles,
  Layers
} from 'lucide-react';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { useOpsStore } from '../../store/opsStore';
import { ResidentHelpdeskView } from '../../components/operations/resident/ResidentHelpdeskView';
import { ResidentFacilityHealthBoard } from '../../components/operations/resident/ResidentFacilityHealthBoard';
import { ResidentEmergencyDirectory } from '../../components/operations/resident/ResidentEmergencyDirectory';

type ResidentTab = 'helpdesk' | 'facility-health' | 'directory';

const SAMPLE_UNITS = [
  { unit: 'B-804', name: 'Dr. Vikram Malhotra', phone: '+91 98450 11223' },
  { unit: 'A-402', name: 'Pooja Sundaram', phone: '+91 97410 99887' },
  { unit: 'C-1201', name: 'Amitabh Sharma', phone: '+91 99000 44332' }
];

export const ResidentOperationsPortal: React.FC = () => {
  const navigate = useNavigate();
  const { fetchTickets, fetchAssets, fetchContracts } = useOpsStore();

  const [activeTab, setActiveTab] = useState<ResidentTab>('helpdesk');
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);

  const currentResident = SAMPLE_UNITS[selectedUnitIndex];

  useEffect(() => {
    fetchTickets();
    fetchAssets();
    fetchContracts();
  }, []);

  return (
    <div className="space-y-6">
      <MobileTopBar title="RESIDENT PORTAL" parentPath="/mobile-home" />

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-white shadow-sm shrink-0">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Resident Experience Portal
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Community
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                Aeris Residences RWA
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Flat {currentResident.unit} ({currentResident.name})
              </span>
            </div>
          </div>
        </div>

        {/* Unit Selector & Switch Back to Admin Button */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Flat Switcher for testing */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-gray-400 font-medium">Switch Flat:</span>
            <select
              value={selectedUnitIndex}
              onChange={(e) => setSelectedUnitIndex(Number(e.target.value))}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
            >
              {SAMPLE_UNITS.map((u, idx) => (
                <option key={u.unit} value={idx}>
                  Flat {u.unit} ({u.name.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate('/operations/tickets')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition shadow-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Switch to Admin Hub</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('helpdesk')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'helpdesk'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>My Flat Helpdesk & Live OTP</span>
        </button>

        <button
          onClick={() => setActiveTab('facility-health')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'facility-health'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Community Facility Health</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'directory'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Emergency Assistance & Directory</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'helpdesk' && (
          <ResidentHelpdeskView 
            unitNumber={currentResident.unit}
            residentName={currentResident.name}
            residentPhone={currentResident.phone}
            entityName="Aeris Residences"
          />
        )}

        {activeTab === 'facility-health' && (
          <ResidentFacilityHealthBoard 
            entityName="Aeris Residences"
          />
        )}

        {activeTab === 'directory' && (
          <ResidentEmergencyDirectory 
            entityName="Aeris Residences"
          />
        )}
      </div>
    </div>
  );
};

export default ResidentOperationsPortal;
