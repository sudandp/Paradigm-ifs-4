import React, { useState } from 'react';
import { Star, MessageSquare, ThumbsUp, X, CheckCircle2, RefreshCw } from 'lucide-react';
import type { OpsTicket } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';

interface TicketRatingModalProps {
  ticket: OpsTicket;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_FEEDBACK_TAGS = [
  'Prompt & On-Time',
  'Polite Technician',
  'High Quality Work',
  'Cleaned Work Area',
  'Took Longer Than Expected',
  'Spares Required Delay',
  'Incomplete Work'
];

export const TicketRatingModal: React.FC<TicketRatingModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { submitTicketRating } = useOpsStore();

  const [rating, setRating] = useState<number>(ticket.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(ticket.feedbackTags || ['Prompt & On-Time', 'High Quality Work']);
  const [comment, setComment] = useState(ticket.feedbackComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitTicketRating(ticket.id, rating, selectedTags, comment);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeStarCount = hoverRating ?? rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Resident Service Rating</h3>
              <p className="text-[11px] text-slate-300">Service Quality & CSAT Audit</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Snippet */}
        <div className="px-6 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs">
          <div>
            <span className="font-mono font-bold text-slate-700 bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px]">
              {ticket.ticketNumber || ticket.id.slice(0, 8)}
            </span>
            <p className="text-gray-800 font-semibold mt-1">{ticket.title}</p>
          </div>
          <div className="text-right text-gray-500 text-[11px]">
            <span>Assigned: {ticket.assignedToName || 'Technician'}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Star selector */}
          <div className="text-center space-y-2">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
              How was the service experience?
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-115 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= activeStarCount
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300 fill-gray-100'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-gray-800">
              {activeStarCount === 5 && '🌟 Outstanding & Prompt'}
              {activeStarCount === 4 && '👍 Good Service'}
              {activeStarCount === 3 && '😐 Average Experience'}
              {activeStarCount === 2 && '👎 Needs Improvement'}
              {activeStarCount === 1 && '⚠️ Very Unsatisfied'}
            </p>
          </div>

          {/* Feedback tags */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">
              Service Highlights & Observations
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_FEEDBACK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                        : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional comment */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">
              Additional Resident Remarks (Optional)
            </label>
            <textarea
              className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800/20"
              rows={2}
              placeholder="e.g. Technician was very respectful and solved the water leak thoroughly..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-xs"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            Save Rating & Finalize Closure
          </button>
        </div>
      </div>
    </div>
  );
};
