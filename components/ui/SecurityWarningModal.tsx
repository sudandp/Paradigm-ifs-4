import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import Button from './Button';

interface SecurityWarningModalProps {
    issues: string[];
    onDismiss?: () => void;
}

/**
 * Modal displayed when security issues (developer mode, location spoofing) are detected.
 * Blocks access to the application until issues are resolved.
 * Responsive: Full-screen on mobile, centered modal on desktop.
 */
const SecurityWarningModal: React.FC<SecurityWarningModalProps> = ({ issues, onDismiss }) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Mobile Layout
    if (isMobile) {
        return (
            <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
                <div className="min-h-screen p-4 flex flex-col">
                    {/* Icon */}
                    <div className="flex justify-center mt-8 mb-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                            <Shield className="w-8 h-8 text-red-600" />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
                        Security Warning
                    </h2>

                    {/* Message */}
                    <div className="space-y-3 mb-4">
                        <p className="text-gray-700 text-center text-sm">
                            Access to this application has been temporarily blocked for security reasons:
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <ul className="space-y-2">
                                {issues.map((issue, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-red-800">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>{issue}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <h3 className="font-semibold text-blue-900 mb-2 text-sm">To continue:</h3>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800">
                            <li>Close browser developer tools (F12)</li>
                            <li>Disable any location spoofing apps or extensions</li>
                            <li>Refresh this page</li>
                        </ol>
                    </div>

                    {/* Alert Notice */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <p className="text-xs text-yellow-800 text-center">
                            ⚠️ Your reporting manager has been notified of this security alert.
                        </p>
                    </div>

                    {/* Dismiss Button (optional) */}
                    {onDismiss && (
                        <Button
                            onClick={onDismiss}
                            variant="outline"
                            className="w-full mt-auto"
                            size="sm"
                        >
                            I Understand
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // Desktop/Web Layout
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                        <Shield className="w-10 h-10 text-red-600" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
                    Security Warning
                </h2>

                {/* Message */}
                <div className="space-y-3 mb-6">
                    <p className="text-gray-700 text-center">
                        Access to this application has been temporarily blocked for security reasons:
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <ul className="space-y-2">
                            {issues.map((issue, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-red-800">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{issue}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">To continue:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                        <li>Close browser developer tools (F12)</li>
                        <li>Disable any location spoofing apps or extensions</li>
                        <li>Refresh this page</li>
                    </ol>
                </div>

                {/* Alert Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                    <p className="text-xs text-yellow-800 text-center">
                        ⚠️ Your reporting manager has been notified of this security alert.
                    </p>
                </div>

                {/* Dismiss Button (optional) */}
                {onDismiss && (
                    <Button
                        onClick={onDismiss}
                        variant="outline"
                        className="w-full"
                    >
                        I Understand
                    </Button>
                )}
            </div>
        </div>
    );
};

export default SecurityWarningModal;
