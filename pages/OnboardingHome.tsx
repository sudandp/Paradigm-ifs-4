import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useOnboardingStore } from '../store/onboardingStore';
import { FileSignature, ArrowLeft } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

const OnboardingHome: React.FC = () => {
  const navigate = useNavigate();
  const { data, reset } = useOnboardingStore();
  const hasDraft = data.personal.firstName || data.personal.lastName;

  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleStart = () => {
    reset(); // Start fresh
    navigate('/onboarding/select-organization');
  };

  const handleContinue = () => {
    navigate('/onboarding/add/personal');
  };

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-[#041b0f] p-4 max-md:pb-36">
        {/* Mobile Top Back Bar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/mobile-home')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Back</span>
          </button>
          <div className="h-[1px] flex-1 bg-[#134426]" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
            ONBOARDING
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-full max-w-sm bg-[#092c19] border border-[#134426] rounded-[28px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* Top accent glow line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#44D62C]/30 to-transparent pointer-events-none" />

            <div className="flex justify-center mb-5">
              <div className="p-4 rounded-2xl bg-[#44D62C]/10 border border-[#44D62C]/25 text-[#44D62C] shadow-[0_0_20px_rgba(68,214,44,0.15)]">
                <FileSignature className="h-9 w-9 stroke-[2.2]" />
              </div>
            </div>

            <h1 className="text-xl font-black text-white tracking-tight mb-2">Employee Onboarding</h1>
            <p className="text-[#7D967B] text-xs font-semibold leading-relaxed mb-6">
              Complete your profile and submit verified documentation in just a few minutes.
            </p>

            <div className="flex flex-col gap-3">
              {hasDraft && (
                <button
                  onClick={handleContinue}
                  className="w-full py-3 px-4 rounded-2xl bg-[#041b0f] border border-[#134426] text-white font-black text-xs uppercase tracking-wider hover:border-[#44D62C]/40 active:scale-95 transition-all cursor-pointer"
                >
                  Continue Previous Application
                </button>
              )}
              <button
                onClick={handleStart}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-sm uppercase tracking-wider shadow-[0_4px_16px_rgba(68,214,44,0.35)] active:scale-95 transition-all cursor-pointer"
              >
                {hasDraft ? 'Start Fresh' : 'Start New Application'}
              </button>
              <button
                onClick={() => navigate('/onboarding/submissions')}
                className="w-full py-3 px-4 rounded-2xl bg-[#041b0f]/80 border border-[#134426] text-[#44D62C] font-black text-xs uppercase tracking-wider hover:bg-[#041b0f] active:scale-95 transition-all cursor-pointer"
              >
                View My Submissions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-card p-8 sm:p-12 rounded-2xl shadow-card text-center w-full max-w-xl">
        <div className="flex justify-center mb-6">
          <div className="bg-accent-light p-4 rounded-full">
            <FileSignature className="h-12 w-12 text-accent-dark" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-primary-text mb-2">Welcome to Employee Onboarding</h2>
        <p className="text-muted mb-8">
          We need to collect some information to get you set up. This should only take a few minutes.
        </p>

        <div className="mt-8 flex justify-center items-center gap-3 flex-wrap">
          {hasDraft && (
            <Button onClick={handleContinue} variant="secondary">
              Continue Draft
            </Button>
          )}
          <Button onClick={handleStart} variant="primary">
            {hasDraft ? 'Start Fresh' : 'Start New Application'}
          </Button>
          <Button onClick={() => navigate('/onboarding/submissions')} variant="outline" className="border-accent text-accent">
            My Submissions
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingHome;