import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { hrmApi } from '../../services/hrm.api';
import toast from 'react-hot-toast';

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
  onCallLogged: () => void;
}

const LogCallModal: React.FC<LogCallModalProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  onCallLogged
}) => {
  const [outcome, setOutcome] = useState<string>('reached');
  const [durationMins, setDurationMins] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [nextCallAt, setNextCallAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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
      // Reset form
      setOutcome('reached');
      setDurationMins(5);
      setNotes('');
      setNextCallAt('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Call with ${candidateName}`}
      hideFooter={true}
      maxWidth="md:max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Call Outcome
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
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Duration (Minutes)
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
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Follow-Up Date & Time (Optional)
          </label>
          <input
            type="datetime-local"
            value={nextCallAt}
            onChange={(e) => setNextCallAt(e.target.value)}
            className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Call Notes / Comments
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Summarize the conversation detail..."
            className="w-full p-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all"
            required
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
