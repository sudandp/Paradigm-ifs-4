// components/WhatsNewModal.tsx
// A premium dark-emerald styled "What's New" modal showcasing updates
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
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(1, 15, 8, 0.85)', backdropFilter: 'blur(8px)' }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(155deg, #052e16 0%, #022c22 60%, #011c15 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: '0 0 50px rgba(16, 185, 129, 0.1), 0 20px 40px rgba(0,0,0,0.6)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle glowing ring decoration */}
          <div className="absolute -inset-px rounded-3xl border border-emerald-500/20 pointer-events-none" />

          <div className="p-7">
            {/* Header Icon */}
            <div className="flex justify-center mb-5">
              <motion.div
                animate={{ 
                  scale: [1, 1.06, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: 'easeInOut' 
                }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
                }}
              >
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </motion.div>
            </div>

            {/* Title / Version */}
            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 uppercase tracking-widest mb-2">
                Version Updated
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight">
                What's New in v{RELEASE_NOTES.version}
              </h2>
              <p className="text-xs text-white/50 mt-1">
                Released on {RELEASE_NOTES.date}
              </p>
            </div>

            {/* Scrollable list of notes */}
            <div 
              className="max-h-[220px] overflow-y-auto mb-6 pr-1 space-y-3 custom-scrollbar"
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
                    transition={{ delay: index * 0.08 + 0.15 }}
                    className="flex items-start gap-3.5 rounded-2xl p-3.5"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div 
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ 
                        background: 'rgba(16, 185, 129, 0.12)', 
                        border: '1px solid rgba(16, 185, 129, 0.2)' 
                      }}
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-white/80 leading-relaxed break-words">
                      {note}
                    </p>
                  </motion.div>
                ))
              ) : (
                <p className="text-sm text-center text-white/40 my-6">
                  Minor improvements and performance upgrades.
                </p>
              )}
            </div>

            {/* CTA Action Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              }}
            >
              Let's Explore
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
