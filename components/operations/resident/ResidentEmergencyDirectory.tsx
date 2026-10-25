import React from 'react';
import { 
  Phone, 
  ShieldAlert, 
  Zap, 
  Droplet, 
  Layers, 
  Building2, 
  ExternalLink, 
  UserCheck,
  Flame,
  MessageSquare
} from 'lucide-react';
import { useOpsStore } from '../../../store/opsStore';

interface ResidentEmergencyDirectoryProps {
  entityName?: string;
}

export const ResidentEmergencyDirectory: React.FC<ResidentEmergencyDirectoryProps> = ({
  entityName = 'Aeris Residences'
}) => {
  const { contracts } = useOpsStore();

  // Find lift and DG vendors from active contracts
  const liftContract = contracts.find(c => c.contractTitle.toLowerCase().includes('lift') || c.contractTitle.toLowerCase().includes('elevator'));
  const dgContract = contracts.find(c => c.contractTitle.toLowerCase().includes('dg') || c.contractTitle.toLowerCase().includes('generator'));
  const stpContract = contracts.find(c => c.contractTitle.toLowerCase().includes('stp'));

  const emergencyContacts = [
    {
      category: 'Critical Safety',
      title: 'Elevator Trapped Passenger Emergency',
      subtitle: liftContract?.vendorName || 'Johnson Lifts OEM 24/7 Rapid Rescue',
      phone: liftContract?.vendorPhone || '+91 94440 98765',
      icon: Layers,
      color: 'bg-red-50 text-red-700 border-red-200',
      actionText: 'Call Lift SOS'
    },
    {
      category: 'Security & Access',
      title: 'Main Security Gate & Guard Intercom',
      subtitle: 'Main Pedestrian & Vehicle Boom Barrier',
      phone: '+91 80 4000 9001',
      icon: ShieldAlert,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      actionText: 'Call Gate'
    },
    {
      category: 'Electrical Emergency',
      title: 'On-Duty Electrician & DG Technician',
      subtitle: dgContract?.vendorName || 'Facility MEP Shift Engineering Team',
      phone: dgContract?.vendorPhone || '+91 98860 55443',
      icon: Zap,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      actionText: 'Call Electrician'
    },
    {
      category: 'Plumbing & Water',
      title: 'On-Duty Society Plumber & Pump House',
      subtitle: stpContract?.vendorName || '24/7 Pipeline Leakage & Tank Control',
      phone: stpContract?.vendorPhone || '+91 98450 12345',
      icon: Droplet,
      color: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      actionText: 'Call Plumber'
    },
    {
      category: 'Fire Safety',
      title: 'Fire Alarm & Hydrant Response Desk',
      subtitle: 'Central Fire Control Room & Security Lead',
      phone: '101',
      icon: Flame,
      color: 'bg-red-100 text-red-800 border-red-300',
      actionText: 'Call Fire Helpline'
    },
    {
      category: 'Administration',
      title: 'Estate Manager & RWA Office',
      subtitle: 'Accounts, NOCs, & Move-In Helpdesk',
      phone: '+91 80 4000 9000',
      icon: Building2,
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      actionText: 'Call Office'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent border border-red-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider">
              24/7 Hotlines
            </span>
            <span className="text-xs font-semibold text-gray-700">{entityName}</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight mt-1">
            Emergency Assistance & Vendor Directory
          </h2>
          <p className="text-xs text-gray-500">
            One-tap direct dialing for urgent technical emergencies, trapped lift rescues, and security intercom
          </p>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {emergencyContacts.map((contact, idx) => {
          const Icon = contact.icon;
          return (
            <div 
              key={idx}
              className="p-5 rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-primary/30 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {contact.category}
                  </span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${contact.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <h4 className="text-sm font-bold text-gray-900 leading-snug">
                  {contact.title}
                </h4>

                <p className="text-xs text-gray-500 leading-relaxed">
                  {contact.subtitle}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-gray-800">
                  {contact.phone}
                </span>

                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{contact.actionText}</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
