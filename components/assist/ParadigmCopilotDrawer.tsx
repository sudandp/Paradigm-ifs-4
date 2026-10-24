import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Sparkles, Bot, AlertTriangle, ShieldCheck,
  CheckCircle2, Clock, Users, Wrench, FileText, ChevronRight,
  Zap, Copy, ArrowUpRight, MessageSquare, PhoneCall, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useAssistStore, AssistMessage } from '../../store/assistStore';
import { MarkdownMessage } from './MarkdownMessage';
import ActionLauncherCard from './ActionLauncherCard';
import toast from 'react-hot-toast';

interface ParadigmCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

export const ParadigmCopilotDrawer: React.FC<ParadigmCopilotDrawerProps> = ({
  isOpen,
  onClose,
  currentPath = window.location.hash || window.location.pathname
}) => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const {
    messages,
    isLoading,
    sendMessage,
    isOfflineModelReady,
    startNewConversation
  } = useAssistStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic context suggestions based on current screen
  const getContextualPrompts = () => {
    const p = currentPath.toLowerCase();

    if (p.includes('verification') || p.includes('onboarding')) {
      return [
        { label: 'Pending Onboarding', prompt: 'Summarize the pending onboarding submissions and required KYC documents' },
        { label: 'Nikoo Homes Attendance', prompt: 'What is Nikoo Homes present today?' },
        { label: 'Security Guard Roster', prompt: 'Who is on duty for Security Guard shift today?' }
      ];
    }

    if (p.includes('attendance') || p.includes('roster')) {
      return [
        { label: 'Nikoo Homes Attendance', prompt: 'What is Nikoo Homes present today?' },
        { label: 'Night Shift C Punches', prompt: 'Show staff who checked in for Night Shift C today' },
        { label: 'Double Duty Audit (14h+)', prompt: 'Audit all staff who worked >= 14 hours across A+B or B+C shifts' }
      ];
    }

    if (p.includes('ticket') || p.includes('support') || p.includes('helpdesk')) {
      return [
        { label: 'Escalated Tickets', prompt: 'Summarize escalated tickets and group them by MEP category' },
        { label: 'Overdue Vendor TAT', prompt: 'Which lift or DG vendor has breached the SLA resolution window?' },
        { label: 'Draft Resident Update', prompt: 'Draft a polite apology notice for elevator maintenance' }
      ];
    }

    if (p.includes('billing') || p.includes('account') || p.includes('defaulter')) {
      return [
        { label: 'Top 5 Defaulters', prompt: 'List top defaulters with dues > ₹50,000 and calculate late payment fee' },
        { label: 'WhatsApp Dues Notice', prompt: 'Draft a firm WhatsApp reminder for Flat E-E-903 regarding pending maintenance of ₹99,288' },
        { label: 'Reconcile UPI vs NEFT', prompt: 'Show status of offline cheque receipts awaiting approval' }
      ];
    }

    // Default global prompts
    return [
      { label: 'Nikoo Attendance Today', prompt: 'What is Nikoo Homes present today?' },
      { label: 'Triage Escalated Tickets', prompt: 'Analyze escalated helpdesk tickets and prioritize critical safety issues' },
      { label: 'DG / STP Inspection', prompt: 'Show standard daily PPM checklist for Diesel Generators and STP' },
      { label: 'Shift Roster Today', prompt: 'Which technicians and security guards are scheduled for Shift A and B today?' }
    ];
  };

  const contextPrompts = getContextualPrompts();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryToSend?: string) => {
    const q = queryToSend || input;
    if (!q.trim() || isLoading) return;

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    await sendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-xs transition-opacity duration-200">
      {/* Slide-over Drawer Panel */}
      <div 
        className={`w-full sm:w-[440px] md:w-[460px] h-full shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-slate-900 border-l border-slate-800 text-slate-100' 
            : 'bg-white border-l border-slate-200/90 text-slate-800'
        }`}
        role="dialog"
        aria-label="Paradigm Copilot Drawer"
      >
        {/* Drawer Header */}
        <div className={`px-4 py-3 flex items-center justify-between border-b ${
          isDark 
            ? 'bg-slate-900/95 border-slate-800' 
            : 'bg-slate-50/95 border-slate-200/90'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/20">
              <Bot className="w-4.5 h-4.5 text-white stroke-[2.2]" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className={`font-semibold text-xs tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Ask Paradigm AI
                </h3>
                <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
                  Copilot
                </span>
              </div>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isOfflineModelReady ? '⚡ Qwen 2.5 Private Engine' : 'Connected to Paradigm ERP'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => startNewConversation()}
              title="New Conversation"
              className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 ${
                isDark 
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md transition-colors ${
                isDark 
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className={`flex-1 overflow-y-auto p-3.5 space-y-3.5 ${
          isDark ? 'bg-slate-900/60' : 'bg-slate-50/50'
        }`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-3 py-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-emerald-500" />
              </div>
              <h4 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                How may I assist you, {user?.name || 'Manager'}?
              </h4>
              <p className={`text-xs max-w-xs mb-5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                I can check live site attendance, summarize tickets, audit shifts, and draft operational notices.
              </p>

              {/* Smart Contextual Suggestions (Mira-style) */}
              <div className="w-full space-y-1.5 text-left">
                <p className={`text-[10px] font-bold uppercase tracking-wider px-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Suggested Actions
                </p>
                {contextPrompts.map((cp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(cp.prompt)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group shadow-2xs ${
                      isDark 
                        ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-emerald-500/40 text-slate-200' 
                        : 'bg-white hover:bg-emerald-50/60 border-slate-200 hover:border-emerald-400 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {cp.label}
                      </div>
                      <div className={`text-[11px] truncate max-w-[320px] ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {cp.prompt}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-xs shadow-xs'
                        : isDark
                          ? 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-xs shadow-xs'
                          : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {m.sender === 'assistant' ? (
                      <div>
                        <MarkdownMessage content={m.content} />
                        {m.actionApp && (
                          <div className="mt-2.5">
                            <ActionLauncherCard app={m.actionApp} />
                          </div>
                        )}
                        {m.isOffline && (
                          <div className={`mt-2 pt-2 border-t flex items-center gap-1 text-[10px] ${
                            isDark ? 'border-slate-700 text-emerald-400' : 'border-slate-100 text-emerald-600'
                          }`}>
                            <Zap className="w-3 h-3" /> Processed On-Device
                          </div>
                        )}
                      </div>
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </div>
                  <span className={`text-[9px] mt-0.5 px-1 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {isLoading && (
                <div className={`flex items-center gap-2 text-xs p-2 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                  </div>
                  <span>Paradigm AI is analyzing ERP records...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Drawer Footer & Input */}
        <div className={`p-3 border-t ${
          isDark 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-slate-200'
        }`}>
          <div className={`relative flex items-end gap-1.5 rounded-xl p-1 border transition-colors ${
            isDark 
              ? 'bg-slate-800/90 border-slate-700 focus-within:border-emerald-500' 
              : 'bg-slate-50 border-slate-300 focus-within:border-emerald-600 focus-within:bg-white'
          }`}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything (e.g. 'Nikoo present today', 'Shift C roster')..."
              className={`flex-1 bg-transparent border-0 resize-none text-xs p-1.5 max-h-24 overflow-y-auto focus:outline-none ${
                isDark ? 'text-white placeholder-slate-400' : 'text-slate-900 placeholder-slate-500'
              }`}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className={`flex items-center justify-between mt-2 text-[9px] px-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span>Press <strong>Enter</strong> to send</span>
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
              <ShieldCheck className="w-3 h-3" /> ISO 9001:2015 Compliant
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParadigmCopilotDrawer;
