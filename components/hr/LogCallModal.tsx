import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { hrmApi } from '../../services/hrm.api';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

export interface AISummaryData {
  summary: string;
  callOutcome: string;
  followUpDate: string | null;
  durationSeconds?: number;
}

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
  onCallLogged: () => void;
  aiSummary?: AISummaryData | null;
}

const LogCallModal: React.FC<LogCallModalProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  onCallLogged,
  aiSummary
}) => {
  const [outcome, setOutcome] = useState<string>('reached');
  const [durationMins, setDurationMins] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [nextCallAt, setNextCallAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-fill from AI summary
  useEffect(() => {
    if (isOpen && aiSummary) {
      if (aiSummary.callOutcome) setOutcome(aiSummary.callOutcome);
      if (aiSummary.summary) setNotes(aiSummary.summary);
      if (aiSummary.followUpDate) setNextCallAt(aiSummary.followUpDate);
      if (aiSummary.durationSeconds) setDurationMins(Math.ceil(aiSummary.durationSeconds / 60) || 1);
    } else if (!isOpen) {
      // Reset when closed
      setOutcome('reached');
      setDurationMins(5);
      setNotes('');
      setNextCallAt('');
    }
  }, [isOpen, aiSummary]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  const AiBadge = () => (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-500 ml-2">
      <Sparkles className="w-3 h-3" /> AI Suggested
    </span>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Call with ${candidateName}`}
      hideFooter={true}
      maxWidth="md:max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {aiSummary && (
          <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
            <p className="text-sm text-indigo-600 font-medium leading-snug">
              AI has auto-filled details based on the call transcript. You can edit them before saving.
            </p>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">
            Call Outcome
            {aiSummary?.callOutcome && outcome === aiSummary.callOutcome && <AiBadge />}
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full h-11 px-3 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            required
          >
            <option value="reached">Reached / Answered</option>
            <option value="no_answer">No Answer</option>
            <option value="callback">Requested Callback</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">
            Duration (Minutes)
            {aiSummary?.durationSeconds && durationMins === Math.ceil(aiSummary.durationSeconds / 60) && <AiBadge />}
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={durationMins}
            onChange={(e) => setDurationMins(Number(e.target.value))}
            className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">
            Follow-Up Date & Time (Optional)
            {aiSummary?.followUpDate && nextCallAt === aiSummary.followUpDate && <AiBadge />}
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
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-slate-500 hover:border-accent hover:text-accent active:scale-95 transition-all"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setNextCallAt(getPresetDateTime(3))}
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-slate-500 hover:border-accent hover:text-accent active:scale-95 transition-all"
            >
              In 3 Days
            </button>
            <button
              type="button"
              onClick={() => setNextCallAt(getPresetDateTime(7))}
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-border bg-page text-slate-500 hover:border-accent hover:text-accent active:scale-95 transition-all"
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

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">
            Call Notes / Comments
            {aiSummary?.summary && notes === aiSummary.summary && <AiBadge />}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Summarize the conversation detail..."
            className="w-full p-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all"
            required={!aiSummary}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="btn btn-secondary btn-md active:scale-95 transition-all">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading} className="btn btn-primary btn-md active:scale-95 transition-all shadow-md">
            Save Call Log
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LogCallModal;
