import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface FloatingBirthdayBannerProps {
  forceShow?: boolean;
  className?: string;
  isMobileCompact?: boolean;
}

export const FloatingBirthdayBanner: React.FC<FloatingBirthdayBannerProps> = ({
  forceShow = false,
  className = '',
  isMobileCompact = false,
}) => {
  const { user } = useAuthStore();
  const [fetchedDob, setFetchedDob] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // Check URL params for preview flag (both standard search params and hash params)
  useEffect(() => {
    const checkPreviewFlag = () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?')
        ? new URLSearchParams(window.location.hash.split('?')[1])
        : null;
      setIsPreview(
        forceShow ||
        urlParams.get('previewBirthday') === 'true' ||
        hashParams?.get('previewBirthday') === 'true'
      );
    };

    checkPreviewFlag();
    window.addEventListener('hashchange', checkPreviewFlag);
    window.addEventListener('popstate', checkPreviewFlag);
    return () => {
      window.removeEventListener('hashchange', checkPreviewFlag);
      window.removeEventListener('popstate', checkPreviewFlag);
    };
  }, [forceShow]);

  // If user DOB isn't yet populated in the user session, fetch it dynamically from Supabase
  useEffect(() => {
    if (!user?.id) return;
    const existingDob = (user as any).date_of_birth || (user as any).dateOfBirth;
    if (existingDob) {
      setFetchedDob(existingDob);
      return;
    }

    let isMounted = true;
    const fetchUserDob = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('date_of_birth')
          .eq('id', user.id)
          .maybeSingle();

        if (isMounted && data?.date_of_birth) {
          setFetchedDob(data.date_of_birth);
        }
      } catch (err) {
        console.warn('[FloatingBirthdayBanner] DOB check error:', err);
      }
    };

    fetchUserDob();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Determine if today is the user's birthday in IST (UTC+5:30) or preview mode
  const isBirthdayToday = useMemo(() => {
    if (isPreview || forceShow) return true;
    if (!user) return false;

    // Active employees only
    if (user.status !== 'active' || (user as any).is_blocked || (user as any).left_date) {
      return false;
    }

    const dob = fetchedDob || (user as any).date_of_birth || (user as any).dateOfBirth;
    if (!dob || typeof dob !== 'string' || dob.length < 10) {
      return false;
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const currentMMDD = `${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;
    const dobMMDD = dob.substring(5, 10);

    return currentMMDD === dobMMDD;
  }, [user, fetchedDob, forceShow, isPreview]);

  // Handle open celebration modal
  const handleOpenCelebration = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } catch {}
    window.dispatchEvent(new CustomEvent('open_birthday_celebration'));
  }, []);

  if (!isBirthdayToday) return null;

  const firstName = (user?.name || 'Paradigm Member').trim().split(' ')[0];

  // Mobile compact circular celebratory button
  if (isMobileCompact) {
    return (
      <AnimatePresence>
        <motion.button
          type="button"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: 1,
          }}
          transition={{
            scale: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' },
            opacity: { duration: 0.3 },
          }}
          onClick={handleOpenCelebration}
          className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px] shadow-md flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          title={`Happy Birthday, ${firstName}! Tap to celebrate 🎉`}
          aria-label="Celebrate birthday"
        >
          <div className="w-full h-full rounded-full bg-slate-900/90 flex items-center justify-center text-sm">
            🎂
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full" />
        </motion.button>
      </AnimatePresence>
    );
  }

  // Desktop Floating Pill Banner
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: [0, -3, 0],
          scale: 1,
        }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{
          y: { repeat: Infinity, duration: 2.8, ease: 'easeInOut' },
          opacity: { duration: 0.3 },
          scale: { duration: 0.3 },
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleOpenCelebration}
        className={`relative group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer select-none transition-all duration-300 shadow-sm hover:shadow-md border ${
          isHovered
            ? 'bg-gradient-to-r from-amber-400/25 via-rose-400/25 to-purple-400/25 border-amber-400 shadow-amber-400/20'
            : 'bg-gradient-to-r from-amber-400/15 via-rose-400/15 to-purple-400/15 border-amber-300/60 dark:border-amber-400/40 shadow-amber-400/10'
        } ${className}`}
        title="Today is your birthday! Click to view your annual celebration card 🎉"
        role="button"
        aria-label={`Happy Birthday ${firstName}! Click to open celebration.`}
      >
        {/* Subtle Ambient Pulse Ring */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 opacity-20 blur-xs group-hover:opacity-40 transition-opacity pointer-events-none" />

        {/* Animated Icon (Cake + Confetti) */}
        <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/30 text-amber-700 dark:text-amber-200 shadow-2xs group-hover:rotate-12 transition-transform duration-300">
          <span className="text-sm select-none">🎂</span>
        </div>

        {/* Festive Text & Greetings */}
        <div className="relative z-10 flex items-center gap-1.5 leading-none">
          <span className="text-xs sm:text-[13px] font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-1">
            Happy Birthday,{' '}
            <strong className="text-amber-600 dark:text-amber-300 font-black">
              {firstName}!
            </strong>
          </span>

          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30">
            <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
            Special Day
          </span>
        </div>

        {/* Action Button: "Celebrate 🎈" */}
        <div className="relative z-10 ml-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer tracking-wide"
          >
            <span>Celebrate</span>
            <span className="text-xs">🎈</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingBirthdayBanner;
