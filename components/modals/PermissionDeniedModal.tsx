import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ShieldAlert } from 'lucide-react';

interface PermissionDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissionName: 'Location' | 'Camera';
}

const PermissionDeniedModal: React.FC<PermissionDeniedModalProps> = ({ isOpen, onClose, permissionName }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title={`${permissionName} Permission Required`}
    >
      <div className="text-center">
        <div className="flex justify-center mb-4">
            <ShieldAlert className="h-10 w-10 text-yellow-500" />
        </div>
        <p className="mb-4">
          {`To use this feature, you need to grant ${permissionName.toLowerCase()} access.`}
        </p>
        <p className="mb-6 text-sm text-muted">
          {`It looks like you have previously denied this permission. Please go to your device's settings, find this app, and enable the ${permissionName.toLowerCase()} permission.`}
        </p>
        <Button onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
};

export default PermissionDeniedModal;