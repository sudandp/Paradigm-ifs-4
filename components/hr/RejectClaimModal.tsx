import React, { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface RejectClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isConfirming?: boolean;
  title?: string;
  label?: string;
  confirmButtonText?: string;
}

const RejectClaimModal: React.FC<RejectClaimModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isConfirming,
  title = "Reject Claim",
  label = "Please provide a reason for rejecting this claim. This will be visible to the employee.",
  confirmButtonText = "Confirm Rejection"
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('A reason for rejection is required.');
      return;
    }
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={title}
      confirmButtonText={confirmButtonText}
      isConfirming={isConfirming}
    >
      <div className="space-y-4">
        <p>{label}</p>
        <div>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            rows={3}
            className={`mt-1 form-input ${error ? 'form-input--error' : ''}`}
            placeholder="e.g., Overtime was not pre-approved."
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </Modal>
  );
};

export default RejectClaimModal;