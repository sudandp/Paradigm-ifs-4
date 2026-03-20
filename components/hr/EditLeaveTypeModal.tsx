import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { LeaveType } from '../../types';

interface EditLeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newType: LeaveType) => void;
  currentType: LeaveType;
  isUpdating?: boolean;
}

const EditLeaveTypeModal: React.FC<EditLeaveTypeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentType,
  isUpdating,
}) => {
  const [selectedType, setSelectedType] = useState<LeaveType>(currentType);
  const leaveTypes: LeaveType[] = ['Earned', 'Sick', 'Floating', 'Comp Off', 'Loss of Pay'];

  useEffect(() => {
    if (isOpen) {
      setSelectedType(currentType);
    }
  }, [isOpen, currentType]);

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Edit Leave Type"
      confirmButtonText="Save Changes"
      isConfirming={isUpdating}
    >
      <div className="space-y-4 my-2">
        <p className="text-sm text-gray-600">
          Select the correct leave type for this request. If the leave is already approved, balances (including Comp Off logs) will be automatically adjusted.
        </p>
        <div className="pt-2">
          <span className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 tracking-wider">Leave Type</span>
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as LeaveType)}
              className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium px-4 pr-10"
            >
              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditLeaveTypeModal;
