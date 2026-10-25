import React from 'react';
import { AlertTriangle, Clock, ShieldAlert, ArrowRight, Filter, Info } from 'lucide-react';
import type { OpsTicket } from '../../types/operations';

interface SlaEscalationBannerProps {
  tickets: OpsTicket[];
  isEscalatedFilterActive: boolean;
  onToggleEscalatedFilter: () => void;
}

export const SlaEscalationBanner: React.FC<SlaEscalationBannerProps> = ({
  tickets,
  isEscalatedFilterActive,
  onToggleEscalatedFilter
}) => {
  const escalatedTickets = tickets.filter(t => 
    t.status !== 'Resolved' && 
    t.status !== 'Closed' && 
    (t.isEscalated || (t.resolutionDueAt && new Date(t.resolutionDueAt) < new Date()) || (t.dueDate && new Date(t.dueDate) < new Date()))
  );

  const p1Breaches = escalatedTickets.filter(t => t.priority === 'P1').length;
  const p2Breaches = escalatedTickets.filter(t => t.priority === 'P2').length;
  const otherBreaches = escalatedTickets.length - p1Breaches - p2Breaches;

  if (escalatedTickets.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 tracking-wide uppercase">All SLAs On Track</h4>
            <p className="text-xs text-emerald-700">Zero escalated helpdesk tickets. Technician response time is optimal.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100/60 px-3 py-1 rounded-md">
          <span>Enterprise SLA Active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 via-red-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left side: Alert message & details */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600 animate-pulse" />
          </div>
          
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Actions Pending
              </span>
              <h3 className="text-sm font-bold text-gray-900">
                {escalatedTickets.length} Escalated {escalatedTickets.length === 1 ? 'Ticket Requires' : 'Tickets Require'} Manager Intervention
              </h3>
            </div>
            
            <p className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
              <span>Standard SLA exceeded.</span>
              {p1Breaches > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-100/80 px-1.5 py-0.2 rounded text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                  {p1Breaches} P1 Critical
                </span>
              )}
              {p2Breaches > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-orange-700 bg-orange-100/80 px-1.5 py-0.2 rounded text-[11px]">
                  {p2Breaches} P2 High
                </span>
              )}
              {otherBreaches > 0 && (
                <span className="text-gray-500 text-[11px]">
                  +{otherBreaches} P3/P4 Standard
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right side: Action Toggle Filter */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={onToggleEscalatedFilter}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
              isEscalatedFilterActive
                ? 'bg-amber-700 text-white hover:bg-amber-800'
                : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100/50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {isEscalatedFilterActive ? 'Show All Tickets' : `Filter ${escalatedTickets.length} Escalated`}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
