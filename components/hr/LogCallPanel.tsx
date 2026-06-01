import React, { useState } from 'react';
import { hrmApi } from '../../services/hrm.api';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { Phone, X, Clock, CalendarClock, MessageSquare, CheckCircle2 } from 'lucide-react';

interface LogCallPanelProps {
  candidateId: string;
  candidateName: string;
  onCallLogged: () => void;
  onClose: () => void;
}

const OUTCOME_OPTIONS = [
  { value: 'reached', label: 'Reached', emoji: '✅' },
  { value: 'no_answer', label: 'No Answer', emoji: '📵' },
  { value: 'callback', label: 'Callback', emoji: '🔁' },
  { value: 'interested', label: 'Interested', emoji: '🟢' },
  { value: 'not_interested', label: 'Not Interested', emoji: '🔴' },
];

const DURATION_PRESETS = [2, 5, 10, 15, 30];

const LogCallPanel: React.FC<LogCallPanelProps> = ({
  candidateId,
  candidateName,
  onCallLogged,
  onClose
}) => {
  const [outcome, setOutcome] = useState<string>('reached');
  const [durationMins, setDurationMins] = useState<number>(5);
  const [customDuration, setCustomDuration] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [nextCallAt, setNextCallAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error('Please add call notes before saving');
      return;
    }
    setLoading(true);
    try {
      await hrmApi.logCall({
        candidateId,
        outcome,
        durationMins: Number(durationMins),
        notes,
        nextCallAt: nextCallAt ? new Date(nextCallAt).toISOString() : null
      });
      toast.success('Call logged successfully');
      onCallLogged();
      onClose();
      // Reset form
      setOutcome('reached');
      setDurationMins(5);
      setCustomDuration(false);
      setNotes('');
      setNextCallAt('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  const getPresetDateTime = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm animate-fade-in-down mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-primary-text">
              Log New Call
            </h3>
            <p className="text-[10px] text-muted mt-0.5">
              with <span className="font-bold text-accent">{candidateName}</span>
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-page border border-border flex items-center justify-center text-muted hover:text-primary-text hover:border-slate-300 transition-all active:scale-95"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Call Outcome Chips */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
            <CheckCircle2 className="w-3 h-3" />
            Call Outcome
          </label>
          <div className="flex flex-wrap gap-2">
            {OUTCOME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOutcome(opt.value)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95 border ${
                  outcome === opt.value
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-page text-muted border-border hover:border-slate-300 hover:text-primary-text'
                }`}
              >
                <span className="text-sm">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration + Follow-up Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Duration */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
              <Clock className="w-3 h-3" />
              Duration (Minutes)
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDurationMins(mins);
                    setCustomDuration(false);
                  }}
                  className={`min-w-[48px] px-3 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95 border ${
                    durationMins === mins && !customDuration
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-page text-muted border-border hover:border-slate-300 hover:text-primary-text'
                  }`}
                >
                  {mins}m
                </button>
              ))}
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customDuration ? durationMins : ''}
                  placeholder="Other"
                  onFocus={() => setCustomDuration(true)}
                  onChange={(e) => {
                    setCustomDuration(true);
                    setDurationMins(Number(e.target.value) || 1);
                  }}
                  className={`w-[80px] h-[42px] px-3 rounded-2xl text-xs font-bold text-center outline-none transition-all border ${
                    customDuration
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20 placeholder:text-white/60'
                      : 'bg-page text-muted border-border hover:border-slate-300 placeholder:text-muted'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
              <CalendarClock className="w-3 h-3" />
              Follow-Up Date & Time
              <span className="text-[8px] font-normal text-slate-400 ml-1">(Optional)</span>
            </label>
            <input
              type="datetime-local"
              value={nextCallAt}
              onChange={(e) => setNextCallAt(e.target.value)}
              className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setNextCallAt(getPresetDateTime(1))}
                className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-muted hover:border-accent hover:text-accent active:scale-95 transition-all"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setNextCallAt(getPresetDateTime(3))}
                className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-muted hover:border-accent hover:text-accent active:scale-95 transition-all"
              >
                In 3 Days
              </button>
              <button
                type="button"
                onClick={() => setNextCallAt(getPresetDateTime(7))}
                className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-muted hover:border-accent hover:text-accent active:scale-95 transition-all"
              >
                In 1 Week
              </button>
              {nextCallAt && (
                <button
                  type="button"
                  onClick={() => setNextCallAt('')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Call Notes */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
            <MessageSquare className="w-3 h-3" />
            Call Notes / Comments
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Summarize the conversation detail — key discussion points, candidate response, action items..."
            className="w-full p-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all placeholder:text-muted"
            required
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted font-mono">
            Outcome: <span className="font-bold text-primary-text">{OUTCOME_OPTIONS.find(o => o.value === outcome)?.label}</span>
            {' · '}
            Duration: <span className="font-bold text-primary-text">{durationMins} min</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-muted hover:text-primary-text transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="btn btn-primary btn-md gap-2 active:scale-95 transition-all shadow-lg shadow-accent/20"
            >
              <Phone className="w-3.5 h-3.5" />
              Save Call Log
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LogCallPanel;
