
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertOctagon, 
  ChevronRight, 
  HandMetal, 
  ShieldAlert, 
  Clock, 
  FileText,
  CheckCircle2,
  Lock,
  User,
  LogOut,
  Send
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { FieldAttendanceViolation } from '../../types';
import toast from 'react-hot-toast';

const BlockedAccessPage: React.FC = () => {
  const { user, logout, updateUserProfile } = useAuthStore();
  const [violations, setViolations] = useState<FieldAttendanceViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchViolations = async () => {
      if (!user) return;
      try {
        const data = await api.getFieldViolations(user.id);
        // Only show pending or escalated ones that need reasoning
        const pending = data.filter(v => v.status === 'pending' || v.status === 'escalated');
        setViolations(pending);
      } catch (error) {
        console.error('Failed to fetch violations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchViolations();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    // Check if all violations have reasons
    const missingReasons = violations.some(v => !reasons[v.id] || reasons[v.id].trim().length < 10);
    if (missingReasons) {
      toast.error('Please provide a detailed reason (at least 10 characters) for each violation.');
      return;
    }

    if (!agreed) {
      toast.error('You must agree to the terms to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Submit all reasons
      await Promise.all(
        violations.map(v => api.submitFieldViolationReason(v.id, reasons[v.id]))
      );

      // 2. Update user profile to record agreement (optional metadata)
      // This allows the App.tsx to see they have "acknowledged" the block
      // We'll use a local state change for now to allow them to Navigate
      toast.success('Reasons submitted. You now have limited access for this month.');
      
      // We don't necessarily clear salaryHold here because only manager approval clears it globally
      // but according to user: "if user aggre for that allow them to access profile page to make entries"
      // So we set a local flag or just rely on the fact that if they've submitted reasons, they can proceed.
      // For now, let's just use a window property or just rely on the user continuing.
      // Better: we can set a custom flag on the user object in store.
      updateUserProfile({ 
        salaryHoldReason: 'Acknowledged - Pending Manager Review' 
      });
      
      // Redirect to profile
      window.location.href = '/profile';
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReasonChange = (id: string, value: string) => {
    setReasons(prev => ({ ...prev, [id]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-emerald-500/30 font-sans">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 mb-8 relative group">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full group-hover:bg-red-500/40 transition-all duration-500" />
            <ShieldAlert className="w-12 h-12 text-red-500 relative z-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
            Account <span className="text-red-500">Restricted</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Attendance violations have exceeded the <span className="text-white font-semibold">3-strike monthly limit</span>. 
            Access is currently limited and salary is on hold.
          </p>
        </motion.div>

        {/* Violations List */}
        <div className="w-full space-y-6 mb-12">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" />
              Pending Violations
            </h2>
            <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-full uppercase tracking-widest">
              Action Required
            </span>
          </div>

          <AnimatePresence>
            {violations.map((v, index) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl overflow-hidden group hover:border-emerald-500/30 transition-all duration-300"
              >
                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-start">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Violation Date</span>
                        <span className="text-lg font-bold">{format(new Date(v.date), 'EEEE, MMMM do')}</span>
                      </div>
                      <div className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-tighter ${
                        v.severity === 'High' ? 'bg-red-500/10 text-red-500' :
                        v.severity === 'Medium' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {v.severity} Severity
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-6 group-hover:bg-slate-950 transition-colors">
                      <div className="flex items-center gap-2 text-red-400 mb-1">
                        <AlertOctagon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{v.violationType.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        System detected {v.violationType === 'missed_punch_out' ? 'a missed mandatory punch-out.' : `${v.sitePercentage.toFixed(1)}% site time (required ${v.requiredSitePercentage}%).`}
                      </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                           <FileText className="w-3.5 h-3.5" />
                           Explain what happened
                        </label>
                        <textarea
                          placeholder="Please provide a detailed justification for this instance..."
                          value={reasons[v.id] || ''}
                          onChange={(e) => handleReasonChange(v.id, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all min-h-[100px] resize-none"
                        />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {violations.length === 0 && !loading && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-12 text-center"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Pending Violations</h3>
              <p className="text-slate-400">Your account should be unblocked shortly. If not, please contact your manager.</p>
            </motion.div>
          )}
        </div>

        {/* Agreement and Actions */}
        {violations.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-12"
          >
            <h3 className="text-2xl font-black mb-6 tracking-tight">Terms of <span className="text-emerald-500">Agreement</span></h3>
            
            <ul className="space-y-4 mb-10">
              {[
                "I acknowledge the attendance policy and the importance of timely punching.",
                "I understand that further violations may lead to disciplinary action.",
                "I agree to provide accurate site data and follow geofencing rules.",
                "I understand that my salary remains on hold until manager approval."
              ].map((term, i) => (
                <li key={i} className="flex gap-4 text-sm text-slate-400 leading-relaxed">
                  <div className="mt-1 shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
                  {term}
                </li>
              ))}
            </ul>

            <div 
              onClick={() => setAgreed(!agreed)}
              className="flex items-center gap-4 mb-10 p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer group hover:border-emerald-500/30 transition-all"
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                agreed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-700 group-hover:border-slate-500'
              }`}>
                {agreed && <CheckCircle2 className="w-4 h-4 text-slate-950 font-bold" />}
              </div>
              <span className={`text-sm font-semibold transition-colors ${agreed ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>
                I agree to the terms above and wish to proceed.
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <button
                disabled={submitting || !agreed}
                onClick={handleSubmit}
                className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 relative overflow-hidden group ${
                  submitting || !agreed 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-white text-slate-950 hover:bg-emerald-500 hover:text-slate-950'
                }`}
              >
                {submitting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Send className="w-5 h-5" /></motion.div>
                ) : (
                  <>
                    <HandMetal className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Agree and Access Profile
                  </>
                )}
              </button>
              
              <button
                onClick={() => logout()}
                className="px-8 py-5 rounded-2xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-500 font-bold text-sm transition-all flex items-center justify-center gap-2 group"
              >
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Logout
              </button>
            </div>
          </motion.div>
        )}

        <p className="mt-12 text-slate-600 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            Paradigm Services Security Enforcement
        </p>
      </div>
    </div>
  );
};

export default BlockedAccessPage;
