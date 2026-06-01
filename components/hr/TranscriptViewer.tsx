import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  CheckSquare, 
  Sparkles, 
  Loader2, 
  FileAudio,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TranscriptViewerProps {
  candidateId: string;
}

interface CallTranscript {
  id: string;
  transcript_text: string;
  summary: string;
  candidate_interest: boolean | string;
  key_points: string[];
  action_items: string[];
  follow_up_date: string | null;
  suggested_stage: string;
  call_outcome: string;
}

interface CallRecording {
  id: string;
  created_at: string;
  duration_seconds: number;
  s3_path: string;
  call_transcripts: CallTranscript[];
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ candidateId }) => {
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, number[]>>({});

  useEffect(() => {
    fetchTranscripts();
  }, [candidateId]);

  useEffect(() => {
    const loaded: Record<string, number[]> = {};
    recordings.forEach(rec => {
      loaded[rec.id] = JSON.parse(localStorage.getItem(`actions_${rec.id}`) || '[]');
    });
    setCheckedItems(loaded);
  }, [recordings]);

  const toggleActionItem = (recId: string, idx: number) => {
    setCheckedItems(prev => {
      const current = prev[recId] || [];
      const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx];
      localStorage.setItem(`actions_${recId}`, JSON.stringify(updated));
      return { ...prev, [recId]: updated };
    });
  };

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('call_recordings')
        .select(`
          id,
          created_at,
          duration_seconds,
          s3_path,
          call_transcripts (*)
        `)
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data || []);
      
      // Auto-expand the most recent if it exists
      if (data && data.length > 0) {
        setExpandedId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching transcripts:', error);
      toast.error('Failed to load call transcripts');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = async (recordingId: string, s3Path: string) => {
    try {
      if (playingId === recordingId) {
        // Stop playing
        setPlayingId(null);
        setAudioUrl(null);
        return;
      }

      if (s3Path === 'FAILED') {
        toast.error('No audio file available for this call');
        return;
      }

      // We only stored the relative path 'audio/filename.wav' in s3_path (or full path depending on uploadData.path)
      // We will generate a signed URL
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(s3Path, 3600); // 1 hour

      if (error) throw error;
      
      setAudioUrl(data.signedUrl);
      setPlayingId(recordingId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load audio recording');
    }
  };

  const handleDownload = async (s3Path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(s3Path, 60);

      if (error) throw error;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = s3Path.split('/').pop() || 'recording.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error('Failed to download recording');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading transcripts...</span>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed">
        <FileAudio className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">No recorded calls yet</h3>
        <p className="text-xs text-slate-500 mt-1">Make a call with the desktop agent to see transcripts here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recordings.map((recording) => {
        const transcript = recording.call_transcripts?.[0];
        const isExpanded = expandedId === recording.id;
        const isPlaying = playingId === recording.id;
        
        const date = new Date(recording.created_at).toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric' 
        });
        const time = new Date(recording.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', minute: '2-digit' 
        });
        
        const mins = Math.floor((recording.duration_seconds || 0) / 60);
        const secs = (recording.duration_seconds || 0) % 60;

        return (
          <div key={recording.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            {/* Header / Summary Row */}
            <div 
              onClick={() => setExpandedId(isExpanded ? null : recording.id)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">{date}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {time}
                  </span>
                </div>
                
                <div className="h-8 w-px bg-slate-200"></div>
                
                <div className="flex flex-col items-start gap-1">
                  <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wide">
                    {mins}:{secs.toString().padStart(2, '0')} mins
                  </span>
                  {transcript && (
                    <>
                      <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-wide">
                        {transcript.call_outcome?.replace('_', ' ')}
                      </span>
                      {transcript.candidate_interest && (
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          String(transcript.candidate_interest).toLowerCase() === 'high' ? 'bg-emerald-50 text-emerald-600' :
                          String(transcript.candidate_interest).toLowerCase() === 'low' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          Interest: {String(transcript.candidate_interest)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {transcript?.suggested_stage && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold border border-amber-200/50">
                    <Sparkles className="w-3 h-3" />
                    Suggested: {transcript.suggested_stage}
                  </span>
                )}
                <div className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && transcript && (
              <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                
                {/* Audio Controls */}
                {recording.s3_path !== 'FAILED' && (
                  <div className="flex flex-col gap-3 mb-6 p-4 bg-white rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Call Recording</h4>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePlayAudio(recording.id, recording.s3_path); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {isPlaying ? 'Stop Audio' : 'Play Audio'}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(recording.s3_path); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                    {isPlaying && audioUrl && (
                      <audio src={audioUrl} controls autoPlay className="w-full h-10 mt-1" />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Col: Summary & Key Points */}
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Summary
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                        {transcript.summary || 'No summary available.'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Key Points</h4>
                      <ul className="space-y-2">
                        {Array.isArray(transcript.key_points) && transcript.key_points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="min-w-1.5 h-1.5 mt-2 rounded-full bg-indigo-400"></span>
                            <span>{point}</span>
                          </li>
                        ))}
                        {(!transcript.key_points || transcript.key_points.length === 0) && (
                          <li className="text-sm text-slate-400 italic">No key points extracted.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Right Col: Action Items & Raw Transcript */}
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> Action Items
                      </h4>
                      <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
                        {Array.isArray(transcript.action_items) && transcript.action_items.map((item, idx) => (
                          <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={(checkedItems[recording.id] || []).includes(idx)}
                              onChange={() => toggleActionItem(recording.id, idx)}
                              className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 transition-colors" 
                            />
                            <span className={`text-sm transition-colors ${
                              (checkedItems[recording.id] || []).includes(idx) ? 'text-slate-400 line-through' : 'text-slate-700 group-hover:text-slate-900'
                            }`}>{item}</span>
                          </label>
                        ))}
                        {(!transcript.action_items || transcript.action_items.length === 0) && (
                          <span className="text-sm text-slate-400 italic">No action items detected.</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Raw Transcript Segment</h4>
                      <div className="bg-slate-100 p-4 rounded-xl max-h-48 overflow-y-auto border border-slate-200">
                        <p className="text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                          {transcript.transcript_text || 'No raw transcript available.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Edge Case: Call failed or no transcript */}
            {isExpanded && !transcript && (
              <div className="p-5 border-t border-slate-100 bg-slate-50 text-center">
                <p className="text-sm text-slate-500 italic">Call failed or transcription was not completed.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
