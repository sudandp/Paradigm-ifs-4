import React from 'react';
import { Download, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { AppVersionInfo } from '../hooks/useAppUpdate';

interface UpdatePromptModalProps {
  updateInfo: AppVersionInfo | null;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({ updateInfo }) => {
  if (!updateInfo) return null;

  const handleUpdate = () => {
    const playStoreUrl = 'market://details?id=com.paradigm.ifs';
    const fallbackUrl = 'https://play.google.com/store/apps/details?id=com.paradigm.ifs';
    
    if (Capacitor.isNativePlatform()) {
      window.open(playStoreUrl, '_system');
    } else {
      window.open(fallbackUrl, '_blank');
    }
  };

  const handleSupport = () => {
    const supportUrl = updateInfo.whatsappGroupUrl || 'https://wa.me/';
    if (Capacitor.isNativePlatform()) {
      window.open(supportUrl, '_system');
    } else {
      window.open(supportUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col items-center p-6 text-center animate-in fade-in zoom-in duration-300">
        
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <Download className="w-8 h-8 text-emerald-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Update Available
        </h2>
        
        <p className="text-gray-600 mb-6">
          A new version ({updateInfo.latestVersionName}) is available. Please update the app to continue using all features.
        </p>

        {updateInfo.releaseNotes && (
          <div className="bg-gray-50 rounded-lg p-4 w-full mb-6 text-left">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-gray-500" /> 
              What's New
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {updateInfo.releaseNotes}
            </p>
          </div>
        )}

        <button
          onClick={handleUpdate}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 mb-3"
        >
          <Download className="w-5 h-5" />
          Update Now
        </button>

        <button
          onClick={handleSupport}
          className="w-full bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7c.9 0 1.8.1 2.6.4l4.9-1.3-1.3 4.9c.3.8.4 1.7.4 2.6Z" />
          </svg>
          WhatsApp Support
        </button>

        {!updateInfo.isMandatory && (
          <button
            onClick={() => {/* Close modal logic if not mandatory */}}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 font-medium py-2 rounded-xl transition-colors"
          >
            Later
          </button>
        )}
      </div>
    </div>
  );
};
