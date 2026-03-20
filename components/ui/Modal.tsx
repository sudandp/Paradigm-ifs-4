import React from 'react';
import Button from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    children: React.ReactNode;
    confirmButtonVariant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'icon';
    confirmButtonText?: string;
    isConfirming?: boolean;
    isLoading?: boolean; // Alias for isConfirming
    maxWidth?: string; // Optional custom max-width
    extraActions?: React.ReactNode; // Optional extra buttons
    footer?: React.ReactNode; // Optional full footer override
    hideFooter?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmButtonVariant = 'danger', confirmButtonText = 'Confirm', isConfirming = false, isLoading, maxWidth = 'md:max-w-md', extraActions, footer, hideFooter = false }) => {
    if (!isOpen) return null;

    // Use isLoading if provided, otherwise fall back to isConfirming
    const loading = isLoading !== undefined ? isLoading : isConfirming;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black bg-opacity-50" aria-modal="true" role="dialog">
            {/* Full screen on mobile, centered modal on desktop */}
            <div className={`bg-card shadow-card flex flex-col overflow-hidden w-full h-full ${maxWidth} md:w-auto md:h-auto md:max-h-[90vh] md:rounded-xl md:animate-fade-in-scale`}>
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-border">
                    <h3 className="text-lg font-bold text-primary-text">{title}</h3>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="text-sm text-muted">
                        {children}
                    </div>
                </div>

                {/* Footer with Buttons */}
                {!hideFooter && (
                <div className="flex-shrink-0 p-6 border-t border-border bg-card">
                    {footer ? footer : (
                        <div className="flex justify-end space-x-3">
                            {extraActions}
                            <Button
                                onClick={onClose}
                                variant="secondary"
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            {onConfirm && (
                                <Button
                                    onClick={onConfirm}
                                    variant={confirmButtonVariant}
                                    isLoading={loading}
                                >
                                    {confirmButtonText}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
