import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { normalizePhoneNumber } from '../../../services/phoneUtils';
import { Mic, Loader2, CheckCircle, PhoneOff } from 'lucide-react';

type Status = 'idle' | 'recording' | 'transcribing' | 'ready' | 'error';

interface TranscriptionStatusProps {
  phoneNumber: string;
  onTranscriptReady?: (id: string) => void;
}

export const TranscriptionStatus: React.FC<TranscriptionStatusProps> = ({ phoneNumber, onTranscriptReady }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [transcriptId, setTranscriptId] = useState<string | null>(null);

  useEffect(() => {
    const sanitizedPhone = normalizePhoneNumber(phoneNumber);
    if (!sanitizedPhone) return;

    // Listen to broadcast events on a scoped topic for this phone number
    const channel = supabase.channel(`call_updates:${sanitizedPhone}`)
      .on('broadcast', { event: 'call_started' }, () => {
        setStatus('recording');
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        setStatus('transcribing');
      })
      .on('broadcast', { event: 'call_processed' }, (payload) => {
        setStatus('ready');
        const recId = payload.payload?.recording_id;
        if (recId) {
          setTranscriptId(recId);
        }
      })
      .on('broadcast', { event: 'call_error' }, () => {
        setStatus('error');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phoneNumber]);

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-slate-800 rounded-lg border border-slate-700 text-sm font-medium">
      <div className="flex items-center gap-3">
        {status === 'recording' && (
          <>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </div>
            <Mic className="w-4 h-4 text-red-400" />
            <span className="text-red-400">Recording Call...</span>
          </>
        )}
        
        {status === 'transcribing' && (
          <>
            <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
            <span className="text-yellow-400">AI is analyzing call...</span>
          </>
        )}

        {status === 'ready' && (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Summary Ready</span>
          </>
        )}

        {status === 'error' && (
          <>
            <PhoneOff className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Call Failed or Not Recorded</span>
          </>
        )}
      </div>

      {status === 'ready' && transcriptId && onTranscriptReady && (
        <button
          onClick={() => onTranscriptReady(transcriptId)}
          className="px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded transition-colors"
        >
          View Summary
        </button>
      )}
    </div>
  );
};
