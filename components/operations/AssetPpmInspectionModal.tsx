import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  Camera, 
  ShieldCheck, 
  X, 
  RefreshCw, 
  Info, 
  Clock, 
  Zap, 
  Droplet, 
  Layers,
  Wrench,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import type { OpsAsset, AssetPpmParameter, TicketCategory, TicketPriority } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';
import { useAuthStore } from '../../store/authStore';

interface AssetPpmInspectionModalProps {
  asset: OpsAsset;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Fallback parameter templates if DB not yet seeded
const FALLBACK_CHECKLISTS: Record<string, { checklistName: string; parameters: AssetPpmParameter[] }> = {
  STP: {
    checklistName: 'Daily Sewage Treatment Plant (STP) Inspection',
    parameters: [
      { id: 'stp_ph', label: 'Treated Water pH Level', unit: 'pH', type: 'NUMBER', min: 6.5, max: 8.5, desc: 'Normal range: 6.5 to 8.5' },
      { id: 'stp_do', label: 'Dissolved Oxygen (DO)', unit: 'mg/L', type: 'NUMBER', min: 1.5, max: 3.0, desc: 'Aeration tank optimal DO' },
      { id: 'stp_chlorine', label: 'Residual Chlorine', unit: 'PPM', type: 'NUMBER', min: 1.0, max: 2.5, desc: 'Disinfection dosing level' },
      { id: 'stp_blower_pressure', label: 'Blower Pressure', unit: 'bar', type: 'NUMBER', min: 0.3, max: 0.6, desc: 'Compressor manifold pressure' },
      { id: 'stp_clarity', label: 'Treated Water Clarity & Odor', type: 'PASS_FAIL', desc: 'Verify water is clear with zero foul odor' }
    ]
  },
  GENERATOR: {
    checklistName: 'Weekly Diesel Generator (DG) Standby Run & Health',
    parameters: [
      { id: 'dg_battery_volt', label: 'Starter Battery Voltage', unit: 'V', type: 'NUMBER', min: 12.4, max: 13.8, desc: 'Lead-acid cranking battery charge' },
      { id: 'dg_diesel_level', label: 'Diesel Day-Tank Level', unit: '%', type: 'NUMBER', min: 50, max: 100, desc: 'Minimum 50% backup capacity required' },
      { id: 'dg_oil_pressure', label: 'Lube Oil Pressure', unit: 'bar', type: 'NUMBER', min: 3.5, max: 5.5, desc: 'Engine oil lubrication pressure' },
      { id: 'dg_coolant_temp', label: 'Coolant Operating Temp', unit: '°C', type: 'NUMBER', min: 75, max: 90, desc: 'Radiator temperature under idle/load' },
      { id: 'dg_amf_auto', label: 'AMF Panel in AUTO Mode', type: 'PASS_FAIL', desc: 'Ensures instantaneous grid-loss failover' }
    ]
  },
  LIFT: {
    checklistName: 'Bi-Weekly Elevator & Safety Interlock Audit',
    parameters: [
      { id: 'lift_ard', label: 'Auto Rescue Device (ARD) Battery', type: 'PASS_FAIL', desc: 'Safely moves elevator to nearest landing on power cut' },
      { id: 'lift_alarm_intercom', label: 'Emergency Alarm & Gate Intercom', type: 'PASS_FAIL', desc: 'Functional 2-way audio to security room' },
      { id: 'lift_door_sensor', label: 'Door Infrared Safety Curtain', type: 'PASS_FAIL', desc: 'Reverses immediately upon obstruction' },
      { id: 'lift_cabin_fan_light', label: 'Cabin Emergency Lighting & Fan', type: 'PASS_FAIL', desc: 'Backup light powers on within 3s' },
      { id: 'lift_floor_leveling', label: 'Floor Leveling Accuracy', unit: 'mm', type: 'NUMBER', min: 0, max: 5, desc: 'Threshold maximum ±5mm tolerance' }
    ]
  },
  BOOSTER_PUMPS: {
    checklistName: 'Daily Hydro-Pneumatic Water Pressure Inspection',
    parameters: [
      { id: 'pmp_delivery_pressure', label: 'Delivery Header Pressure', unit: 'bar', type: 'NUMBER', min: 3.5, max: 5.5, desc: 'Constant supply pressure to upper residential floors' },
      { id: 'pmp_suction_pressure', label: 'Suction Manifold Pressure', unit: 'bar', type: 'NUMBER', min: 1.0, max: 2.5, desc: 'Underground sumps water head' },
      { id: 'pmp_current_amps', label: 'Running Motor Current', unit: 'Amps', type: 'NUMBER', min: 8.0, max: 18.0, desc: 'Full motor phase load current' },
      { id: 'pmp_auto_toggle', label: 'Duty/Standby Auto-Alternation', type: 'PASS_FAIL', desc: 'Panel alternates pumps to prevent mechanical wear' },
      { id: 'pmp_gland_leak', label: 'Mechanical Seal Leakage', type: 'PASS_FAIL', desc: 'Verify zero abnormal water leakage' }
    ]
  }
};

const getTicketCategory = (category: string): TicketCategory => {
  switch (category) {
    case 'STP':
    case 'BOOSTER_PUMPS':
    case 'WTP':
      return 'Plumbing';
    case 'GENERATOR':
    case 'ELECTRICAL_PANEL':
    case 'HT_YARD':
      return 'Electrical';
    case 'LIFT':
    case 'FIRE_FIGHTING':
    default:
      return 'General';
  }
};

const getTicketPriority = (assetCategory: string, outOfRangeList: string[], readings: Record<string, any>): TicketPriority => {
  const hasFail = Object.values(readings).some(v => v === 'FAIL');
  if (hasFail) return 'P1';
  
  if (assetCategory === 'GENERATOR' && readings['dg_battery_volt'] && parseFloat(readings['dg_battery_volt']) < 12.0) {
    return 'P1';
  }
  if (assetCategory === 'BOOSTER_PUMPS' && readings['pmp_delivery_pressure'] && parseFloat(readings['pmp_delivery_pressure']) < 2.0) {
    return 'P1';
  }
  if (assetCategory === 'STP' && readings['stp_ph'] && (parseFloat(readings['stp_ph']) < 6.0 || parseFloat(readings['stp_ph']) > 9.0)) {
    return 'P1';
  }

  return 'P2';
};

export const AssetPpmInspectionModal: React.FC<AssetPpmInspectionModalProps> = ({
  asset,
  isOpen,
  onClose,
  onSuccess
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { assetChecklists, fetchAssetChecklists, logAssetInspection, createTicket } = useOpsStore();

  const [qrVerified, setQrVerified] = useState(false);
  const [readings, setReadings] = useState<Record<string, any>>({});
  const [abnormalityNotes, setAbnormalityNotes] = useState('');
  const [autoDispatchTicket, setAutoDispatchTicket] = useState(true);
  const [createdTicket, setCreatedTicket] = useState<{
    id: string;
    ticketNumber: string;
    priority: TicketPriority;
    title: string;
    category: TicketCategory;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQrVerified(false);
      setReadings({});
      setAbnormalityNotes('');
      setCreatedTicket(null);
      setAutoDispatchTicket(true);
      setErrorMessage(null);
      fetchAssetChecklists(asset.category);
    }
  }, [isOpen, asset.id, asset.category]);

  if (!isOpen) return null;

  // Active checklist parameters
  const dbChecklist = assetChecklists.find(c => c.assetCategory === asset.category);
  const activeParams: AssetPpmParameter[] = dbChecklist?.parameters?.length 
    ? dbChecklist.parameters 
    : (FALLBACK_CHECKLISTS[asset.category]?.parameters || FALLBACK_CHECKLISTS['STP'].parameters);

  const checklistTitle = dbChecklist?.checklistName || FALLBACK_CHECKLISTS[asset.category]?.checklistName || `${asset.category} Health Inspection`;

  // Auto-check for out-of-range values
  const outOfRangeParams: string[] = [];
  activeParams.forEach(param => {
    const val = readings[param.id];
    if (param.type === 'NUMBER' && val !== undefined && val !== '') {
      const num = parseFloat(val);
      if (param.min !== undefined && num < param.min) outOfRangeParams.push(`${param.label} (${num} ${param.unit}) < Min ${param.min}`);
      if (param.max !== undefined && num > param.max) outOfRangeParams.push(`${param.label} (${num} ${param.unit}) > Max ${param.max}`);
    } else if (param.type === 'PASS_FAIL' && val === 'FAIL') {
      outOfRangeParams.push(`${param.label} Failed Safety Inspection`);
    }
  });

  const hasAbnormalities = outOfRangeParams.length > 0;
  const computedPriority = getTicketPriority(asset.category, outOfRangeParams, readings);
  const computedCategory = getTicketCategory(asset.category);

  const handleSimulateQrScan = () => {
    setQrVerified(true);
  };

  const handleSubmit = async () => {
    if (!qrVerified) {
      setErrorMessage('Physical QR scan required to verify on-site presence at the equipment');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let createdTktId: string | undefined = undefined;

      // Auto-dispatch emergency work order if abnormalities detected
      if (hasAbnormalities && autoDispatchTicket) {
        const newTicket = await createTicket({
          entityId: asset.entityId || '00000000-0000-0000-0000-000000000000',
          title: `[PPM Alert] ${asset.name} (${asset.assetCode}) - ${outOfRangeParams.length} Deviation(s)`,
          description: `Emergency Work Order triggered from on-site digital PPM inspection.\n\nEquipment: ${asset.name} (${asset.assetCode})\nCategory: ${asset.category}\nLocation: ${asset.location}\nCapacity: ${asset.capacity || 'N/A'}\nAMC Vendor: ${asset.amcVendorName || 'In-House Technical Team'}\n\nObserved Deviations:\n${outOfRangeParams.map(p => `• ${p}`).join('\n')}\n\nTechnician Remarks: ${abnormalityNotes || 'None'}\nInspected By: ${user?.name || 'On-Duty Technician'}\nInspection Time: ${new Date().toLocaleString()}`,
          category: computedCategory,
          priority: computedPriority,
          status: 'Open',
          unitNumber: `Plant Room / ${asset.location}`,
          residentName: 'Facility PPM Sensor Monitor',
          reportedByName: `${user?.name || 'Technician'} (PPM Auto-Trigger)`,
          assetId: asset.id,
          assetCode: asset.assetCode
        });

        createdTktId = newTicket.id;
        setCreatedTicket({
          id: newTicket.id,
          ticketNumber: newTicket.ticketNumber || 'TKT-NEW',
          priority: computedPriority,
          title: newTicket.title,
          category: computedCategory
        });
      }

      await logAssetInspection({
        assetId: asset.id,
        checklistId: dbChecklist?.id,
        inspectedBy: user?.id,
        inspectedByName: user?.name || 'On-Duty Technician',
        inspectedAt: new Date().toISOString(),
        qrScanned: true,
        parameterReadings: readings,
        hasAbnormalities,
        abnormalityNotes: hasAbnormalities 
          ? `${outOfRangeParams.join('; ')}. Notes: ${abnormalityNotes}` 
          : abnormalityNotes || 'All parameters within OEM operating range',
        ticketId: createdTktId
      });

      if (!hasAbnormalities || !autoDispatchTicket) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit inspection log');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdTicket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Emergency Work Order Generated</h3>
                <p className="text-[11px] text-amber-200/80">Asset PPM Abnormality Protocol</p>
              </div>
            </div>
            <button onClick={() => { onClose(); onSuccess(); }} className="text-slate-400 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="text-center space-y-2 py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 border-2 border-amber-200 shadow-xs mb-1">
                <Wrench className="w-7 h-7" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-base font-extrabold text-slate-900 bg-gray-100 border border-gray-300 px-3 py-1 rounded-lg">
                  {createdTicket.ticketNumber}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  createdTicket.priority === 'P1'
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {createdTicket.priority} Priority
                </span>
              </div>
              <h4 className="font-bold text-gray-900 text-sm mt-1">{createdTicket.title}</h4>
            </div>

            {/* Equipment & SLA Box */}
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-gray-500 font-semibold">Equipment Tag:</span>
                <span className="font-mono font-bold text-gray-900">{asset.assetCode} • {asset.name}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-gray-500 font-semibold">Location / Bay:</span>
                <span className="font-bold text-gray-900">{asset.location}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-gray-500 font-semibold">Assigned Trade / Dept:</span>
                <span className="font-bold text-gray-900">{createdTicket.category} Engineering</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-gray-500 font-semibold">SLA Resolution Target:</span>
                <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                  {createdTicket.priority === 'P1' ? '2 Hours (Critical Emergency)' : '6 Hours (High)'}
                </span>
              </div>
            </div>

            {/* Deviations recorded */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                Triggering Deviations Recorded:
              </span>
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1 text-xs">
                {outOfRangeParams.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-red-800 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed bg-blue-50/60 border border-blue-200/80 p-2.5 rounded-xl text-blue-900">
              ℹ️ In accordance with standard operational reliability protocols, the asset status has been updated to <strong>Critical Fault</strong> and on-duty MEP supervisors have been alerted.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-end gap-2">
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-gray-700 hover:text-gray-900 transition"
            >
              Close & Back to Register
            </button>
            <button
              onClick={() => {
                onSuccess();
                onClose();
                navigate(`/operations/tickets?search=${encodeURIComponent(createdTicket.ticketNumber)}`);
              }}
              className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Track in Helpdesk Work Orders</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{checklistTitle}</h3>
              <p className="text-[11px] text-slate-300">Digital Preventive Maintenance (PPM) & Physical QR Audit</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Asset Header Info */}
        <div className="px-6 py-3 bg-slate-50 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-800 bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px]">
                {asset.assetCode}
              </span>
              <h4 className="font-bold text-gray-900">{asset.name}</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                {asset.category}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">Location: {asset.location} {asset.capacity ? `• Capacity: ${asset.capacity}` : ''}</p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {qrVerified ? (
              <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Physical QR Verified
              </span>
            ) : (
              <button
                onClick={handleSimulateQrScan}
                className="flex items-center gap-1.5 font-bold text-slate-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2.5 py-1 rounded-lg transition"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-800" />
                Scan Equipment QR Tag
              </button>
            )}
          </div>
        </div>

        {/* Body Form */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!qrVerified && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
              <QrCode className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold">Physical Tag Scan Required</h5>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  In compliance with ISO 55001 asset management standards, technicians must scan the QR code sticker physically affixed to the machine body to unlock reading submissions.
                </p>
                <button
                  onClick={handleSimulateQrScan}
                  className="mt-2 px-3 py-1 bg-amber-800 text-white font-bold rounded-lg text-[11px] hover:bg-amber-900 transition"
                >
                  Confirm Physical Presence (Scan QR)
                </button>
              </div>
            </div>
          )}

          {/* Abnormal parameters banner */}
          {hasAbnormalities && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1 animate-pulse">
              <div className="flex items-center gap-1.5 font-bold text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                Parameter Deviation Detected! Will auto-flag a Critical Work Order:
              </div>
              <ul className="list-disc list-inside text-[11px] pl-1 font-medium space-y-0.5">
                {outOfRangeParams.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Checklist Parameters Grid */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              Operating Parameters & Readings ({activeParams.length} checkpoints)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activeParams.map((param) => {
                const currentVal = readings[param.id] ?? '';
                const isOutOfRange = (param.type === 'NUMBER' && currentVal !== '' && (
                  (param.min !== undefined && parseFloat(currentVal) < param.min) ||
                  (param.max !== undefined && parseFloat(currentVal) > param.max)
                )) || (param.type === 'PASS_FAIL' && currentVal === 'FAIL');

                return (
                  <div 
                    key={param.id} 
                    className={`p-3.5 rounded-xl border transition ${
                      isOutOfRange 
                        ? 'border-red-300 bg-red-50/50' 
                        : 'border-gray-200 bg-gray-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <label className="text-xs font-bold text-gray-800">{param.label}</label>
                      {param.unit && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded">
                          {param.unit}
                        </span>
                      )}
                    </div>
                    {param.desc && <p className="text-[10px] text-gray-500 mb-2">{param.desc}</p>}

                    {param.type === 'NUMBER' ? (
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          disabled={!qrVerified}
                          value={currentVal}
                          onChange={(e) => setReadings(r => ({ ...r, [param.id]: e.target.value }))}
                          placeholder={param.min !== undefined && param.max !== undefined ? `Standard: ${param.min} - ${param.max}` : 'Enter reading...'}
                          className={`w-full px-3 py-1.5 text-xs font-bold border rounded-lg focus:outline-none focus:ring-1 ${
                            isOutOfRange 
                              ? 'border-red-400 bg-white text-red-700 focus:ring-red-400' 
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-slate-800'
                          } disabled:opacity-50`}
                        />
                      </div>
                    ) : param.type === 'PASS_FAIL' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!qrVerified}
                          onClick={() => setReadings(r => ({ ...r, [param.id]: 'PASS' }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                            currentVal === 'PASS'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-emerald-50'
                          } disabled:opacity-50`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK / Normal
                        </button>
                        <button
                          type="button"
                          disabled={!qrVerified}
                          onClick={() => setReadings(r => ({ ...r, [param.id]: 'FAIL' }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                            currentVal === 'FAIL'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-red-50'
                          } disabled:opacity-50`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Defect / Alarm
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        disabled={!qrVerified}
                        value={currentVal}
                        onChange={(e) => setReadings(r => ({ ...r, [param.id]: e.target.value }))}
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white disabled:opacity-50"
                        placeholder="Observation notes..."
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Abnormality Detected Alert & Auto-Dispatch Preview */}
          {hasAbnormalities && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                  <h5 className="font-bold text-xs text-amber-900">
                    Parameter Abnormalities Detected ({outOfRangeParams.length})
                  </h5>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                  Auto-Dispatch: {computedPriority} SLA
                </span>
              </div>
              <ul className="text-[11px] text-amber-800 space-y-0.5 list-disc list-inside">
                {outOfRangeParams.map((param, idx) => (
                  <li key={idx} className="font-medium text-red-700">{param}</li>
                ))}
              </ul>
              <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDispatchTicket}
                    onChange={(e) => setAutoDispatchTicket(e.target.checked)}
                    className="rounded border-amber-300 text-slate-900 focus:ring-slate-800"
                  />
                  <span>Auto-generate emergency Helpdesk work order upon logging</span>
                </label>
              </div>
            </div>
          )}

          {/* Observations & Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">
              Technician Remarks / Preventive Maintenance Observations
            </label>
            <textarea
              disabled={!qrVerified}
              rows={2}
              value={abnormalityNotes}
              onChange={(e) => setAbnormalityNotes(e.target.value)}
              placeholder="e.g. Cleared suction strainer, topped up 2 liters coolant, AMF panel test successful..."
              className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-800 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !qrVerified}
            className={`px-5 py-2 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-xs ${
              hasAbnormalities && autoDispatchTicket
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : hasAbnormalities && autoDispatchTicket ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
            ) : (
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {hasAbnormalities && autoDispatchTicket 
              ? 'Submit PPM Log & Trigger Work Order' 
              : 'Save & Submit Digital PPM Log'}
          </button>
        </div>
      </div>
    </div>
  );
};
