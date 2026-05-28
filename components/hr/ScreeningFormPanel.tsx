import React, { useState, useEffect } from 'react';
import { hrmApi } from '../../services/hrm.api';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';

interface ScreeningFormPanelProps {
  candidateId: string;
  onScreeningSaved: () => void;
}

const ScreeningFormPanel: React.FC<ScreeningFormPanelProps> = ({ candidateId, onScreeningSaved }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  
  // Form fields state
  const [currentCtc, setCurrentCtc] = useState<string>('');
  const [expectedCtc, setExpectedCtc] = useState<string>('');
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
  const [qualification, setQualification] = useState<string>('Graduate');
  const [englishProficiency, setEnglishProficiency] = useState<string>('intermediate');
  const [notes, setNotes] = useState<string>('');
  
  const fetchScreening = async () => {
    setLoading(true);
    try {
      const data = await hrmApi.getScreening(candidateId);
      if (data) {
        setCurrentCtc(data.currentCtc ? String(data.currentCtc) : '');
        setExpectedCtc(data.expectedCtc ? String(data.expectedCtc) : '');
        setNoticePeriodDays(data.noticePeriodDays || 30);
        setQualification(data.qualification || 'Graduate');
        setEnglishProficiency(data.englishProficiency || 'intermediate');
        setNotes(data.notes || '');
      }
    } catch (err: any) {
      // 404 is acceptable if no screening exists yet
      if (err.message && !err.message.includes('404') && !err.message.includes('not found')) {
        console.error(err);
        toast.error('Failed to load screening data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreening();
  }, [candidateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrmApi.saveScreening(candidateId, {
        currentCtc: currentCtc ? Number(currentCtc) : null,
        expectedCtc: expectedCtc ? Number(expectedCtc) : null,
        noticePeriodDays: Number(noticePeriodDays),
        qualification,
        englishProficiency,
        notes
      });
      toast.success('Screening saved successfully');
      onScreeningSaved();
      fetchScreening(); // reload
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save screening');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-50">
        <ClipboardList className="w-5 h-5 text-slate-400" />
        <h3 className="text-base font-bold text-primary-text uppercase tracking-tight">Candidate Screening Form</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Current Monthly CTC (INR)
            </label>
            <input
              type="number"
              value={currentCtc}
              onChange={(e) => setCurrentCtc(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Expected Monthly CTC (INR)
            </label>
            <input
              type="number"
              value={expectedCtc}
              onChange={(e) => setExpectedCtc(e.target.value)}
              placeholder="e.g. 30000"
              className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Notice Period (Days)
            </label>
            <input
              type="number"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
              placeholder="e.g. 30"
              className="w-full h-11 px-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Highest Qualification
            </label>
            <select
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              className="w-full h-11 px-3 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            >
              <option value="Under Graduate">Under Graduate</option>
              <option value="Graduate">Graduate</option>
              <option value="Post Graduate">Post Graduate</option>
              <option value="Diploma">Diploma / ITI</option>
              <option value="12th Pass">12th Pass</option>
              <option value="10th Pass">10th Pass</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              English Communication
            </label>
            <select
              value={englishProficiency}
              onChange={(e) => setEnglishProficiency(e.target.value)}
              className="w-full h-11 px-3 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            >
              <option value="basic">Basic / Beginner</option>
              <option value="intermediate">Intermediate / Functional</option>
              <option value="advanced">Advanced / Fluent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Recruiter Interview Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add candidate evaluation details and notes..."
            className="w-full p-4 bg-page border border-border rounded-2xl text-sm text-primary-text outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" isLoading={saving} className="btn btn-primary btn-md active:scale-95 transition-all shadow-md">
            Save Screening Details
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ScreeningFormPanel;
