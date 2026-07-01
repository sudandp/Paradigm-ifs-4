// components/WhatsNewModal.tsx
// A sleek and optimized "What's New" modal showcasing updates
// to the user when they launch the app after an update.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import { RELEASE_NOTES } from '../src/config/releaseNotes';

interface WhatsNewModalProps {
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose }) => {
  const notesList = RELEASE_NOTES.notes || [];

  return (
    <AnimatePresence>
      <motion.div
        key="whats-new-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
        style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-[#0F172A] rounded-[24px] overflow-hidden shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle top glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 opacity-80" />

          <div className="p-8">
            {/* Header Content */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-5 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Sparkles className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-center">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                  Update v{RELEASE_NOTES.version}
                </span>
                <h2 className="text-3xl font-bold text-white mt-4 mb-2 tracking-tight">
                  What's New
                </h2>
                <p className="text-sm text-slate-400">
                  Released on {RELEASE_NOTES.date}
                </p>
              </div>
            </div>

            {/* Scrollable list of notes */}
            <div 
              className="max-h-[240px] overflow-y-auto mb-8 pr-2 space-y-4 custom-scrollbar"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(16, 185, 129, 0.3) transparent'
              }}
            >
              {notesList.length > 0 ? (
                notesList.map((note, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.1 }}
                    className="flex gap-4 items-start"
                  >
                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-[15px] text-slate-300 leading-relaxed font-medium">
                      {note}
                    </p>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-slate-400 my-8">
                  Minor improvements and performance upgrades.
                </p>
              )}
            </div>

            {/* CTA Button */}
            <button
              onClick={onClose}
              className="w-full group flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            >
              Continue to App
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
