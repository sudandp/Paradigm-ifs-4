import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Download, Smartphone, CheckCircle2, ChevronRight } from 'lucide-react';

interface AutoCallTranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const AutoCallTranscriptionModal: React.FC<AutoCallTranscriptionModalProps> = ({ 
  isOpen, 
  onClose,
  onComplete 
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleNext = () => {
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
    else {
      onComplete();
      onClose();
    }
  };

  const getDownloadUrl = () => {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0
      ? (import.meta.env as any).VITE_AGENT_DOWNLOAD_MAC || '#'
      : (import.meta.env as any).VITE_AGENT_DOWNLOAD_WIN || '#';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Setup Auto-Transcription"
      maxWidth="md:max-w-md"
      hideFooter
    >
      <div className="space-y-6 pt-2">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= num ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {num}
              </div>
              {num < 3 && (
                <div className={`w-12 h-1 mx-2 rounded-full transition-colors ${
                  step > num ? 'bg-indigo-600' : 'bg-slate-100'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 min-h-[220px] flex flex-col items-center text-center justify-center">
          {step === 1 && (
            <>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Download Desktop Agent</h3>
              <p className="text-sm text-slate-600 mb-6">
                Our lightweight background agent bridges your phone and browser to capture call audio.
              </p>
              <a 
                href={getDownloadUrl()}
                download
                className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download Now
              </a>
            </>
          )}

          {step === 2 && (
            <>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Connect Your Phone</h3>
              <p className="text-sm text-slate-600 mb-4 px-4">
                Plug your Android device into your computer via USB, open the agent, and enter a pairing token.
              </p>
              <div className="text-xs font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-500 mb-2">
                Settings → Auto-Transcription → Generate Token
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to Go!</h3>
              <p className="text-sm text-slate-600 mb-4 px-4">
                When the agent tray icon is green, it's monitoring for calls. Call a candidate to see it in action!
              </p>
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button 
            variant="secondary" 
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose()}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button variant="primary" onClick={handleNext} className="flex items-center gap-1">
            {step === 3 ? 'Finish Setup' : 'Next Step'} 
            {step < 3 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
