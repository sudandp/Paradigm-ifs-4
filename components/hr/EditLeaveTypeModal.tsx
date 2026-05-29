import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { LeaveRequest, LeaveType } from '../../types';
import { Clock, MapPin, Calendar, FileText } from 'lucide-react';

interface EditLeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: Partial<LeaveRequest>) => void;
  request: LeaveRequest | null;
  isUpdating?: boolean;
}

const EditLeaveTypeModal: React.FC<EditLeaveTypeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  request,
  isUpdating,
}) => {
  // Core Leave Fields
  const [leaveType, setLeaveType] = useState<LeaveType>('Earned');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dayOption, setDayOption] = useState<'full' | 'half'>('full');
  const [reason, setReason] = useState<string>('');

  // Correction/Permission specific fields
  const [correctionStatus, setCorrectionStatus] = useState<'Present' | 'Site Visit' | 'W/H'>('Present');
  const [locationName, setLocationName] = useState<string>('');
  const [punchIn, setPunchIn] = useState<string>('09:00');
  const [punchOut, setPunchOut] = useState<string>('18:00');
  const [includeBreak, setIncludeBreak] = useState<boolean>(false);
  const [breakIn, setBreakIn] = useState<string>('13:00');
  const [breakOut, setBreakOut] = useState<string>('14:00');
  const [includeSiteOt, setIncludeSiteOt] = useState<boolean>(false);
  const [siteOtIn, setSiteOtIn] = useState<string>('18:00');
  const [siteOtOut, setSiteOtOut] = useState<string>('20:00');

  const leaveTypes: LeaveType[] = [
    'Earned',
    'Sick',
    'Floating',
    'Comp Off',
    'Loss of Pay',
    'Maternity',
    'Child Care',
    'Pink Leave',
    'WFH',
    'Correction',
    'Permission',
  ];

  // Prefill fields when the modal opens or request changes
  useEffect(() => {
    if (isOpen && request) {
      setLeaveType(request.leaveType);
      setStartDate(request.startDate || '');
      setEndDate(request.endDate || '');
      setDayOption(request.dayOption || 'full');
      setReason(request.reason || '');

      const details = request.correctionDetails;
      if (details) {
        setCorrectionStatus(details.status || 'Present');
        setLocationName(details.locationName || '');
        setPunchIn(details.punchIn || '09:00');
        setPunchOut(details.punchOut || '18:00');
        setIncludeBreak(!!details.includeBreak);
        setBreakIn(details.breakIn || '13:00');
        setBreakOut(details.breakOut || '14:00');
        setIncludeSiteOt(!!details.includeSiteOt);
        setSiteOtIn(details.siteOtIn || '18:00');
        setSiteOtOut(details.siteOtOut || '20:00');
      } else {
        // Safe resets
        setCorrectionStatus('Present');
        setLocationName('');
        setPunchIn('09:00');
        setPunchOut('18:00');
        setIncludeBreak(false);
        setBreakIn('13:00');
        setBreakOut('14:00');
        setIncludeSiteOt(false);
        setSiteOtIn('18:00');
        setSiteOtOut('20:00');
      }
    }
  }, [isOpen, request]);

  const handleConfirm = () => {
    const updates: Partial<LeaveRequest> = {
      leaveType,
      startDate,
      endDate: ['Correction', 'Permission'].includes(leaveType) ? startDate : endDate,
      dayOption: ['Correction', 'Permission'].includes(leaveType) ? 'full' : dayOption,
      reason,
    };

    // Attach correction details if Correction or Permission type is selected
    if (['Correction', 'Permission'].includes(leaveType)) {
      updates.correctionDetails = {
        status: correctionStatus,
        punchIn,
        punchOut,
        includeBreak,
        breakIn: includeBreak ? breakIn : undefined,
        breakOut: includeBreak ? breakOut : undefined,
        locationName,
        includeSiteOt,
        siteOtIn: includeSiteOt ? siteOtIn : undefined,
        siteOtOut: includeSiteOt ? siteOtOut : undefined,
      };
    } else {
      updates.correctionDetails = null; // Reset correction details for standard leaves
    }

    onConfirm(updates);
  };

  if (!isOpen || !request) return null;

  const isCorrectionOrPermission = ['Correction', 'Permission'].includes(leaveType);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Edit Leave Request"
      confirmButtonText="Save Changes"
      confirmButtonVariant="primary"
      isConfirming={isUpdating}
      maxWidth="md:max-w-2xl"
    >
      <div className="space-y-6 my-2 text-gray-700">
        <p className="text-xs text-gray-500 leading-relaxed border-b border-gray-100 pb-3">
          Modify request parameters below. If the request is already approved, any leave balance or comp off adjustments will be calculated automatically.
        </p>

        {/* Section 1: Core Parameters */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Core Parameters
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leave Type */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Type</label>
              <div className="relative">
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium px-4 pr-10"
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === 'Floating' ? 'Blue Leave' : type}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Day Option (hidden for corrections/permissions) */}
            {!isCorrectionOrPermission && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Day Option</label>
                <div className="relative">
                  <select
                    value={dayOption}
                    onChange={(e) => setDayOption(e.target.value as 'full' | 'half')}
                    className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium px-4 pr-10"
                  >
                    <option value="full">Full Day</option>
                    <option value="half">Half Day</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                {isCorrectionOrPermission ? 'Target Date' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-950 text-sm font-medium px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* End Date (hidden for corrections/permissions) */}
            {!isCorrectionOrPermission && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-955 text-sm font-medium px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed explanation..."
              className="w-full rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium p-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* Section 2: Time Correction / Permission Details */}
        {isCorrectionOrPermission && (
          <div className="space-y-4 pt-5 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Time Corrections & Category Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Status Category</label>
                <div className="relative">
                  <select
                    value={correctionStatus}
                    onChange={(e) => setCorrectionStatus(e.target.value as 'Present' | 'Site Visit' | 'W/H')}
                    className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium px-4 pr-10"
                  >
                    <option value="Present">Present (Office)</option>
                    <option value="Site Visit">Site Visit (Field)</option>
                    <option value="W/H">Work From Home</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Location Name (only if Present or Site Visit) */}
              {['Present', 'Site Visit'].includes(correctionStatus) && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Location / Site Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder={correctionStatus === 'Site Visit' ? 'e.g. Client Site' : 'e.g. Head Office'}
                      className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium pl-10 pr-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Check-In / Check-Out Times */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Punch In
                </label>
                <input
                  type="time"
                  value={punchIn}
                  onChange={(e) => setPunchIn(e.target.value)}
                  className="w-full h-10 rounded-lg bg-white border border-gray-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Punch Out
                </label>
                <input
                  type="time"
                  value={punchOut}
                  onChange={(e) => setPunchOut(e.target.value)}
                  className="w-full h-10 rounded-lg bg-white border border-gray-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Lunch Break details */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeBreak}
                  onChange={(e) => setIncludeBreak(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Include Lunch Break?</span>
              </label>

              {includeBreak && (
                <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100/60 grid grid-cols-2 gap-4 animate-fade-in-down">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-orange-500 uppercase tracking-wider">Break In</label>
                    <input
                      type="time"
                      value={breakIn}
                      onChange={(e) => setBreakIn(e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border border-orange-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-orange-500 uppercase tracking-wider">Break Out</label>
                    <input
                      type="time"
                      value={breakOut}
                      onChange={(e) => setBreakOut(e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border border-orange-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Overtime details */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSiteOt}
                  onChange={(e) => setIncludeSiteOt(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Include Site Overtime?</span>
              </label>

              {includeSiteOt && (
                <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/60 grid grid-cols-2 gap-4 animate-fade-in-down">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Site OT In</label>
                    <input
                      type="time"
                      value={siteOtIn}
                      onChange={(e) => setSiteOtIn(e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border border-indigo-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Site OT Out</label>
                    <input
                      type="time"
                      value={siteOtOut}
                      onChange={(e) => setSiteOtOut(e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border border-indigo-200 text-gray-900 text-xs font-medium px-3 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditLeaveTypeModal;
