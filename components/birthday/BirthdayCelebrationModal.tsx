import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { X, Sparkles, ChevronLeft, ChevronRight, PartyPopper, Volume2, VolumeX, Heart, MessageSquareHeart } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface BirthdayCelebrationModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const BirthdayCelebrationModal: React.FC<BirthdayCelebrationModalProps> = ({
  forceOpen = false,
  onClose
}) => {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0); // 0: Gifts, 1: Cake, 2: Balloons
  const [viewMode, setViewMode] = useState<'mobile-walkthrough' | 'landing-page'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return 'landing-page';
    }
    return 'mobile-walkthrough';
  });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPlayingSong, setIsPlayingSong] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<'honors' | 'wishes'>('honors');
  const [wishes, setWishes] = useState<any[]>([]);
  const [isLoadingWishes, setIsLoadingWishes] = useState(false);
  const [thankedWishIds, setThankedWishIds] = useState<Set<string>>(new Set());

  // Fetch received birthday wishes from colleagues
  const fetchWishes = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingWishes(true);
    try {
      const { data, error } = await supabase
        .from('birthday_wishes')
        .select('*')
        .eq('celebrant_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setWishes(data);
        const thanked = new Set<string>();
        data.forEach(w => {
          if (w.reaction) thanked.add(w.id);
        });
        setThankedWishIds(thanked);
      }
    } catch (err) {
      console.warn('[BirthdayModal] Error loading wishes:', err);
    } finally {
      setIsLoadingWishes(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchWishes();
    }
  }, [isOpen, fetchWishes]);

  // Handle Celebrant 1-Tap "Thank You" Reaction back to sender
  const handleThankColleague = async (wish: any) => {
    if (!wish?.id || !user?.id) return;
    try {
      try {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      } catch {}

      setThankedWishIds(prev => new Set(prev).add(wish.id));

      await supabase
        .from('birthday_wishes')
        .update({ reaction: 'thank_you', reaction_at: new Date().toISOString() })
        .eq('id', wish.id);

      await supabase.from('notifications').insert({
        user_id: wish.sender_id,
        message: `❤️ ${user.name} thanked you for your birthday wish!`,
        type: 'celebration',
        severity: 'normal',
        is_read: false,
        metadata: {
          source: 'birthday_engine',
          bday_type: 'wish_thank_you',
          celebrant_id: user.id,
          celebrant_name: user.name,
        }
      });

      toast.success(`Sent thank you to ${wish.sender_name || 'colleague'}! ❤️`, { icon: '🙏' });
    } catch (e) {
      console.error('Failed to thank colleague:', e);
    }
  };

  // Stop background birthday song cleanly
  const stopSong = useCallback(() => {
    if (songTimerRef.current) {
      clearTimeout(songTimerRef.current);
      songTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (_) {}
      setIsPlayingSong(false);
    }
  }, []);

  const toggleAudioMute = () => {
    if (audioRef.current) {
      const next = !isAudioMuted;
      audioRef.current.muted = next;
      setIsAudioMuted(next);
    }
  };

  // Check if today is the user's birthday or preview requested
  useEffect(() => {
    const checkDetection = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?') 
        ? new URLSearchParams(window.location.hash.split('?')[1]) 
        : null;
      const isPreview = forceOpen || urlParams.get('previewBirthday') === 'true' || hashParams?.get('previewBirthday') === 'true';

      if (isPreview) {
        setIsOpen(true);
        triggerCelebrationHaptics();
        return;
      }

      if (!user) {
        setIsOpen(false);
        stopSong();
        return;
      }

      const dob = (user as any).date_of_birth || (user as any).dateOfBirth;
      if (!dob || typeof dob !== 'string' || dob.length < 10) {
        setIsOpen(false);
        stopSong();
        return;
      }

      // Active employees only (inactive/left employees are skipped)
      if (user.status !== 'active' || (user as any).is_blocked || (user as any).left_date) {
        setIsOpen(false);
        stopSong();
        return;
      }

      // Check IST date
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + istOffset);
      const currentMMDD = `${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;
      const dobMMDD = dob.substring(5, 10);

      if (currentMMDD === dobMMDD) {
        const currentYear = istDate.getUTCFullYear();
        const storageKey = `bday_celebrated_${user.id}_${currentYear}`;
        const alreadyWished = localStorage.getItem(storageKey);

        if (!alreadyWished) {
          setIsOpen(true);
          triggerCelebrationHaptics();
          return;
        }
      }

      // If condition not met, close and stop
      setIsOpen(false);
      stopSong();
    };

    checkDetection();

    window.addEventListener('hashchange', checkDetection);
    window.addEventListener('popstate', checkDetection);
    const handleCustomTrigger = () => {
      setIsOpen(true);
      triggerCelebrationHaptics();
    };
    window.addEventListener('open_birthday_celebration', handleCustomTrigger);

    return () => {
      window.removeEventListener('hashchange', checkDetection);
      window.removeEventListener('popstate', checkDetection);
      window.removeEventListener('open_birthday_celebration', handleCustomTrigger);
    };
  }, [user, forceOpen, stopSong]);

  const triggerCelebrationHaptics = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 180);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 360);
    } catch (_) {}
  };

  // Play birthday song helper with infinite looping on current screen
  const playBirthdaySong = useCallback(() => {
    if (!audioRef.current || !isOpen) return;
    if (viewMode === 'mobile-walkthrough' && activeSlide !== 0) return;
    try {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.85;
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsPlayingSong(true))
          .catch((err) => {
            console.log('[BirthdayAudio] Waiting for interaction to play:', err);
            setIsPlayingSong(false);
          });
      }
    } catch (e) {
      console.warn('[BirthdayAudio] Play error:', e);
    }
  }, [isOpen, viewMode, activeSlide]);

  // Synchronized Birthday Background Song:
  // Loops continuously as long as user is on this screen (activeSlide === 0).
  // Immediately stops when: user clicks Next, Skip, Close, or navigates away.
  useEffect(() => {
    if (!isOpen) {
      stopSong();
      return;
    }
    if (viewMode === 'mobile-walkthrough' && activeSlide !== 0) {
      stopSong();
      return;
    }

    playBirthdaySong();

    // If browser policy requires user gesture, play on first touch/click anywhere
    const handleFirstGesture = () => {
      if (audioRef.current && audioRef.current.paused && isOpen && (viewMode === 'landing-page' || activeSlide === 0)) {
        audioRef.current.loop = true;
        audioRef.current.play().then(() => setIsPlayingSong(true)).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    window.addEventListener('click', handleFirstGesture, { once: true });

    // Stop song if user switches tab
    const handleVisibility = () => {
      if (document.hidden) {
        stopSong();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopSong();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen, activeSlide, playBirthdaySong, stopSong]);

  // Falling confetti canvas animation
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f59e0b', '#ec4899', '#06b6d4', '#10b981', '#fbbf24', '#ffffff', '#8b5cf6', '#a855f7'];
    const particleCount = 75;
    const particles: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      speedY: number;
      speedX: number;
      rotation: number;
      rotSpeed: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 8 + 6,
        h: Math.random() * 12 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotSpeed: Math.random() * 4 - 2
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.y += p.speedY;
        p.x += Math.sin(p.y / 20) * 1.5 + p.speedX;
        p.rotation += p.rotSpeed;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleDismiss = () => {
    stopSong();
    if (user?.id) {
      const now = new Date();
      const istYear = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCFullYear();
      localStorage.setItem(`bday_celebrated_${user.id}_${istYear}`, 'true');
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped left -> next
        setActiveSlide((prev) => (prev + 1) % 3);
      } else {
        // Swiped right -> prev
        setActiveSlide((prev) => (prev - 1 + 3) % 3);
      }
      triggerCelebrationHaptics();
    }
    setTouchStartX(null);
  };

  if (!isOpen) return null;

  const firstName = user?.name ? user.name.split(' ')[0] : 'Champion';
  const fullUserName = user?.name || 'Paradigm Team Member';
  const userPhoto = user?.photoUrl || (user as any)?.photo_url || null;
  const userRole = (user as any)?.designation || (user as any)?.role || 'Field Professional';
  const userSite = (user as any)?.siteName || (user as any)?.site || 'Paradigm Integrated Services';

    return (
    <div 
      className={`fixed inset-0 z-[999999] w-full h-[100dvh] overflow-hidden select-none flex flex-col ${
        viewMode === 'landing-page'
          ? 'bg-gradient-to-br from-[#290457] via-[#200244] to-[#120028] text-white'
          : 'bg-black/95 flex items-center justify-center'
      } animate-in fade-in duration-300`}
      onPointerDown={() => {
        if (audioRef.current && audioRef.current.paused && isOpen && (viewMode === 'landing-page' || activeSlide === 0)) {
          audioRef.current.play().then(() => setIsPlayingSong(true)).catch(() => {});
        }
      }}
    >
      {/* Background Birthday Audio Tag with Infinite Loop */}
      <audio
        ref={audioRef}
        src="/audio/birthday-song.mp3"
        preload="auto"
        playsInline
        loop
      />
      
      {/* Google Fonts Import for Sacramento & Montserrat */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=Sacramento&display=swap');
        
        .font-sacramento {
          font-family: 'Sacramento', cursive;
        }
        .font-montserrat {
          font-family: 'Montserrat', sans-serif;
        }
        
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes balloon-sway {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(2.5deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        .animate-float-gentle {
          animation: float-gentle 4s ease-in-out infinite;
        }
        .animate-balloon-sway {
          animation: balloon-sway 3.5s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: star-twinkle 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* Confetti Animation Canvas - Covers entire 1-page viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      />

      {/* ═════════════════════════════════════════════════════════════════════════
          MODE 1: FULL-BLEED MOBILE CARDS WALKTHROUGH
         ═════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'mobile-walkthrough' && (
        <div 
          className="relative z-20 w-full h-full sm:h-auto sm:max-w-md sm:rounded-[36px] font-montserrat flex flex-col justify-between bg-gradient-to-b from-[#5c24e5] via-[#4f1dd4] to-[#3a13a8] text-white overflow-hidden shadow-2xl sm:border sm:border-white/20"
          style={{ minHeight: '100dvh' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Organic Floating Pastel Violet Background Blob */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[340px] h-[360px] sm:w-[380px] sm:h-[400px] rounded-[45%_55%_65%_35%/50%_60%_40%_50%] bg-[#8b5cf6]/35 blur-2xl pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#ec4899]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 -left-12 w-48 h-48 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />

          {/* Top Header Bar */}
          <header className="relative z-20 pt-safe pt-4 px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/favicon.png" 
                alt="Paradigm Logo" 
                className="w-7 h-7 object-contain rounded-md shadow-md"
              />
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                Special Day
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isPlayingSong && (
                <button
                  type="button"
                  onClick={toggleAudioMute}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white border border-white/15 transition cursor-pointer"
                  title={isAudioMuted ? "Unmute Birthday Song" : "Mute Birthday Song"}
                >
                  {isAudioMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-white/50" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  )}
                </button>
              )}

              {activeSlide < 2 && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] font-bold text-white/80 transition cursor-pointer border border-white/10"
                >
                  Skip
                </button>
              )}



              <button
                type="button"
                onClick={handleDismiss}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white border border-white/20 transition cursor-pointer shadow-md"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Employee Recognition Chip */}
          <div className="relative z-20 mt-3 mx-auto px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-3 max-w-[90%]">
            <div className="relative w-11 h-11 rounded-full border-2 border-amber-300 overflow-hidden bg-amber-200 flex-shrink-0 shadow-md">
              {userPhoto ? (
                <img src={userPhoto} alt={fullUserName} className="w-full h-full object-cover object-top" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-base font-black text-[#581c87]">
                  {firstName[0]}
                </span>
              )}
            </div>
            <div className="leading-tight text-left min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-white truncate">{fullUserName}</span>
              <span className="block text-[10px] text-amber-300 font-bold uppercase tracking-wider truncate">
                {userRole} • {userSite}
              </span>
            </div>
          </div>

          {/* Center Slide Carousel */}
          <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-2 my-auto">
            {activeSlide === 0 && (
              <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 w-full max-w-sm">
                <div className="relative w-72 h-60 sm:h-64 flex items-center justify-center">
                  <svg viewBox="0 0 280 220" className="w-full h-full drop-shadow-2xl" fill="none">
                    <ellipse cx="140" cy="195" rx="100" ry="12" fill="#2e0854" opacity="0.6" />
                    <circle cx="50" cy="40" r="4" fill="#fbbf24" />
                    <circle cx="230" cy="45" r="4" fill="#38bdf8" />
                    <circle cx="70" cy="80" r="3" fill="#ec4899" />
                    <circle cx="210" cy="90" r="3.5" fill="#a3e635" />
                    <path d="M40 60 Q55 75 45 95" stroke="#ec4899" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M240 65 Q225 80 235 100" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M45 120 L55 190 L105 190 L115 120 Z" fill="#facc15" />
                    <path d="M60 120 L70 190" stroke="#38bdf8" strokeWidth="4" />
                    <path d="M90 120 L100 190" stroke="#38bdf8" strokeWidth="4" />
                    <ellipse cx="80" cy="120" rx="35" ry="6" fill="#eab308" />
                    <path d="M65 120 Q80 90 95 120" stroke="#0284c7" strokeWidth="3" fill="none" />
                    <rect x="110" y="100" width="105" height="90" rx="8" fill="#e11d48" />
                    <rect x="105" y="90" width="115" height="18" rx="5" fill="#be123c" />
                    <path d="M110 125 L125 115 L140 125 L155 115 L170 125 L185 115 L200 125 L215 115" stroke="#fbbf24" strokeWidth="3" fill="none" />
                    <path d="M110 145 L125 135 L140 145 L155 135 L170 145 L185 135 L200 145 L215 135" stroke="#fbbf24" strokeWidth="3" fill="none" />
                    <path d="M110 165 L125 155 L140 165 L155 155 L170 165 L185 155 L200 165 L215 155" stroke="#fbbf24" strokeWidth="3" fill="none" />
                    <path d="M135 60 C110 45, 95 78, 150 90 Z" fill="#84cc16" />
                    <path d="M185 60 C210 45, 225 78, 170 90 Z" fill="#84cc16" />
                    <circle cx="160" cy="85" r="8" fill="#65a30d" />
                    <rect x="85" y="130" width="65" height="60" rx="6" fill="#7c3aed" />
                    <rect x="112" y="130" width="12" height="60" fill="#facc15" />
                    <rect x="80" y="122" width="75" height="14" rx="4" fill="#6d28d9" />
                    <rect x="112" y="122" width="12" height="14" fill="#eab308" />
                    <path d="M108 108 C96 100, 90 115, 115 122 Z" fill="#facc15" />
                    <path d="M128 108 C140 100, 146 115, 121 122 Z" fill="#facc15" />
                    <circle cx="118" cy="120" r="4" fill="#ca8a04" />
                    <rect x="195" y="145" width="45" height="45" rx="5" fill="#06b6d4" />
                    <rect x="214" y="145" width="8" height="45" fill="#f43f5e" />
                    <rect x="192" y="139" width="51" height="10" rx="3" fill="#0891b2" />
                    <circle cx="218" cy="138" r="4" fill="#e11d48" />
                  </svg>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
                  Happy Birthday!
                </h2>
                <p className="text-sm sm:text-base text-white/90 font-medium leading-relaxed mt-2 px-3">
                  Warmest birthday wishes to you, <strong className="text-amber-300 font-extrabold">{firstName}</strong>! May your special day bring joy, happiness, and celebrations.
                </p>
              </div>
            )}

            {activeSlide === 1 && (
              <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 w-full max-w-sm">
                <div className="relative w-72 h-60 sm:h-64 flex items-center justify-center">
                  <svg viewBox="0 0 280 220" className="w-full h-full drop-shadow-2xl" fill="none">
                    <ellipse cx="140" cy="198" rx="85" ry="10" fill="#2e0854" opacity="0.6" />
                    <path d="M125 195 L135 155 L145 155 L155 195 Z" fill="#f59e0b" />
                    <ellipse cx="140" cy="195" rx="45" ry="8" fill="#d97706" />
                    <ellipse cx="140" cy="155" rx="80" ry="12" fill="#fbbf24" />
                    <path d="M68 150 C68 125, 212 125, 212 150 L212 110 C212 90, 68 90, 68 110 Z" fill="#06b6d4" />
                    <ellipse cx="140" cy="110" rx="72" ry="11" fill="#38bdf8" />
                    <path d="M85 105 C85 85, 195 85, 195 105 L195 65 C195 50, 85 50, 85 65 Z" fill="#ec4899" />
                    <ellipse cx="140" cy="65" rx="55" ry="9" fill="#f472b6" />
                    <circle cx="140" cy="35" r="14" fill="#fbbf24" />
                    <circle cx="115" cy="40" r="11" fill="#a855f7" />
                    <circle cx="165" cy="40" r="11" fill="#06b6d4" />
                    <path d="M140 49 L140 65" stroke="#ffffff" strokeWidth="3" />
                    <path d="M115 51 L115 65" stroke="#ffffff" strokeWidth="2.5" />
                    <path d="M165 51 L165 65" stroke="#ffffff" strokeWidth="2.5" />
                  </svg>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
                  A Sweet Year Ahead!
                </h2>
                <p className="text-sm sm:text-base text-white/90 font-medium leading-relaxed mt-2 px-3">
                  Celebrating your dedication and passion. May this year bring you sweetness, prosperity, and tremendous success.
                </p>
              </div>
            )}

            {activeSlide === 2 && (
              <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 w-full max-w-sm">
                <div className="relative w-72 h-60 sm:h-64 flex items-center justify-center">
                  <svg viewBox="0 0 280 220" className="w-full h-full drop-shadow-2xl" fill="none">
                    <ellipse cx="140" cy="200" rx="80" ry="10" fill="#2e0854" opacity="0.6" />
                    <path d="M140 150 Q130 110 140 70" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" fill="none" opacity="0.7" />
                    <ellipse cx="140" cy="60" rx="28" ry="34" fill="#fbbf24" />
                    <polygon points="138,94 142,94 140,98" fill="#d97706" />
                    <path d="M140 150 Q100 120 100 80" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" fill="none" opacity="0.7" />
                    <ellipse cx="95" cy="75" rx="24" ry="30" fill="#ec4899" />
                    <polygon points="93,105 97,105 95,109" fill="#be185d" />
                    <path d="M140 150 Q180 120 185 80" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" fill="none" opacity="0.7" />
                    <ellipse cx="185" cy="75" rx="24" ry="30" fill="#06b6d4" />
                    <polygon points="183,105 187,105 185,109" fill="#0891b2" />
                    <rect x="110" y="150" width="60" height="50" rx="6" fill="#7c3aed" />
                    <rect x="135" y="150" width="10" height="50" fill="#facc15" />
                    <circle cx="140" cy="148" r="4" fill="#ca8a04" />
                  </svg>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
                  Reach New Heights!
                </h2>
                <p className="text-sm sm:text-base text-white/90 font-medium leading-relaxed mt-2 px-3">
                  You make Paradigm proud every single day. We wish you an inspiring year filled with accomplishments!
                </p>
              </div>
            )}
          </main>

          {/* Navigation Dots & Progression Action Bar */}
          <footer className="relative z-20 pb-safe pb-5 px-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    stopSong();
                    setActiveSlide(idx);
                    triggerCelebrationHaptics();
                  }}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    activeSlide === idx
                      ? 'w-7 h-2 bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="w-full flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={activeSlide === 0}
                onClick={() => {
                  stopSong();
                  setActiveSlide((prev) => Math.max(0, prev - 1));
                  triggerCelebrationHaptics();
                }}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition border border-white/15 cursor-pointer flex-shrink-0 ${
                  activeSlide === 0 
                    ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/40 border-transparent' 
                    : 'bg-white/10 hover:bg-white/20 active:scale-95 text-white'
                }`}
                title="Previous Screen"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSong();
                  if (activeSlide < 2) {
                    setActiveSlide((prev) => prev + 1);
                  } else {
                    handleDismiss();
                  }
                  triggerCelebrationHaptics();
                }}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-[0.98] text-[#3a13a8] font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(251,191,36,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {activeSlide < 2 ? (
                  <>
                    <span>Next Screen</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <PartyPopper className="w-4 h-4" />
                    <span>Thank You! Enter Workspace</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSong();
                  if (activeSlide < 2) {
                    setActiveSlide((prev) => prev + 1);
                  } else {
                    handleDismiss();
                  }
                  triggerCelebrationHaptics();
                }}
                className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition border border-white/15 cursor-pointer flex-shrink-0"
                title={activeSlide < 2 ? "Next Screen" : "Enter Workspace"}
              >
                {activeSlide < 2 ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <PartyPopper className="w-5 h-5 text-amber-300" />
                )}
              </button>
            </div>

            <span className="text-[10px] text-white/60 tracking-wider">
              Paradigm IFS Cultural Honors • ISO 9001:2015
            </span>
          </footer>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          MODE 2: 100% FULL-BLEED 1-PAGE LANDING PAGE (Edge-to-Edge Desktop View)
          Fits on ONE single page with zero scrolling and NO outer black bars
         ═════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'landing-page' && (
        <div className="relative z-20 w-full h-[100dvh] flex flex-col justify-between overflow-hidden">
          
          {/* Background Ambient Glowing Orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#8b5cf6]/25 blur-3xl" />
            <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-[#ec4899]/15 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-[30rem] h-[30rem] rounded-full bg-[#f59e0b]/15 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-cyan-400/15 blur-3xl" />
          </div>

          {/* ── Top Header Bar (Full Bleed Edge-to-Edge) ── */}
          <header className="relative z-30 px-6 sm:px-10 lg:px-16 py-3.5 flex items-center justify-between border-b border-white/10 bg-black/15 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 p-0.5 shadow-md flex items-center justify-center">
                <img src="/favicon.png" alt="Paradigm Logo" className="w-full h-full object-contain rounded-[10px]" />
              </div>
              <div className="leading-tight">
                <span className="font-black text-sm sm:text-base tracking-widest text-white uppercase block">
                  Paradigm IFS
                </span>
                <span className="text-[10px] text-amber-300 font-extrabold tracking-widest block uppercase">
                  Annual Birthday Honors
                </span>
              </div>
            </div>

            {/* Tab Switcher: Celebration Honors vs Colleagues' Wishes */}
            <div className="inline-flex items-center p-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab('honors')}
                className={`px-3.5 py-1 rounded-full text-xs transition-all font-black flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'honors'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-200 text-[#2b0066] shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span>🎉 Honors Card</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('wishes');
                  fetchWishes();
                }}
                className={`px-3.5 py-1 rounded-full text-xs transition-all font-black flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'wishes'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-200 text-[#2b0066] shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span>💌 Colleagues' Wishes</span>
                {wishes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                    {wishes.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-white/80">
              {/* Sound Equalizer / Mute Toggle Button */}
              <button
                type="button"
                onClick={toggleAudioMute}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center gap-2 text-white border border-white/15 transition cursor-pointer shadow-sm"
                title={isAudioMuted ? "Unmute Birthday Song" : "Mute Birthday Song"}
              >
                {isAudioMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-[11px] font-bold text-white/60">Music Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span className="text-[11px] font-bold text-amber-300">Birthday Song Playing</span>
                  </>
                )}
              </button>



              {/* Dismiss Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white border border-white/20 transition cursor-pointer shadow-md"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ── 2-Column Hero Content: Perfectly Balanced to Fit on One Screen ── */}
          {activeTab === 'honors' ? (
          <div className="relative z-20 px-6 sm:px-12 lg:px-20 py-2 lg:py-4 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center flex-1 min-h-0 w-full max-w-7xl mx-auto my-auto overflow-hidden">
            
            {/* Left Column: Sacramento Cursive Title + Wish + CTA */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left space-y-3.5 lg:space-y-4 justify-center">
              
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[11px] font-black tracking-widest uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  Honoring You Today
                </span>
                
                {/* Large Sacramento Cursive First Name */}
                <div className="relative pt-1">
                  <h1 className="font-sacramento text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-white tracking-wide leading-[0.95] drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]">
                    {firstName}
                  </h1>
                  <div className="absolute -top-2 -right-5 animate-twinkle">
                    <Sparkles className="w-6 h-6 lg:w-7 lg:h-7 text-[#ffb703] fill-[#ffb703]" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
                  Wishing You a Wonderful Birthday!
                </h2>
                <p className="text-xs sm:text-sm lg:text-base font-extrabold text-[#ffb703] tracking-wide">
                  Celebrating your valuable role at Paradigm IFS
                </p>
              </div>

              <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-lg font-medium">
                On behalf of our entire leadership, field staff, and colleagues across all Paradigm sites, we celebrate your dedication, talents, and inspiring contributions. May your special day bring joy, happiness, and celebrations!
              </p>

              {/* CTAs */}
              <div className="pt-2 flex items-center justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={() => {
                    triggerCelebrationHaptics();
                    handleDismiss();
                  }}
                  className="px-9 py-4 rounded-full bg-white text-[#24044b] hover:bg-amber-100 hover:shadow-[0_10px_25px_rgba(255,255,255,0.35)] active:scale-95 transition-all font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-black/40 flex items-center gap-2.5 cursor-pointer"
                >
                  <PartyPopper className="w-4 h-4 text-[#ff3385]" />
                  <span>Enter Workspace</span>
                </button>
              </div>

              {/* Bottom Illustrated Cake (from 8057902.jpg) */}
              <div className="pt-2 flex items-center gap-3">
                <div className="relative w-24 h-20">
                  <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-xl" fill="none">
                    <ellipse cx="60" cy="85" rx="55" ry="12" fill="#00c4cc" />
                    <rect x="20" y="45" width="80" height="38" rx="8" fill="#4d1a7f" />
                    <ellipse cx="60" cy="82" rx="40" ry="6" fill="#3b0f66" />
                    <circle cx="50" cy="65" r="2.5" fill="#ffffff" />
                    <circle cx="70" cy="65" r="2.5" fill="#ffffff" />
                    <path d="M56 71 Q60 76 64 71" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M20 52 Q28 64 35 52 Q43 64 50 52 Q58 66 65 52 Q73 66 80 52 Q88 64 95 52 Q100 60 100 48 L20 48 Z" fill="#ffb703" />
                    <rect x="20" y="42" width="80" height="10" rx="5" fill="#f59e0b" />
                    <rect x="36" y="24" width="4" height="20" rx="2" fill="#ff3385" />
                    <rect x="58" y="20" width="4" height="24" rx="2" fill="#ff3385" />
                    <rect x="80" y="24" width="4" height="20" rx="2" fill="#ff3385" />
                    <path d="M38 18 C38 12, 40 8, 40 4 C40 8, 42 12, 42 18 C42 20, 38 20, 38 18 Z" fill="#fbbf24" className="animate-pulse" />
                    <path d="M60 14 C60 8, 62 4, 62 0 C62 4, 64 8, 64 14 C64 16, 60 16, 60 14 Z" fill="#fbbf24" className="animate-pulse" />
                    <path d="M82 18 C82 12, 84 8, 84 4 C84 8, 86 12, 86 18 C86 20, 82 20, 82 18 Z" fill="#fbbf24" className="animate-pulse" />
                  </svg>
                </div>
                <div className="flex flex-col gap-0.5 text-[#ffb703]">
                  <Sparkles className="w-4 h-4 animate-twinkle" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00c4cc]">
                    Celebration Cake
                  </span>
                </div>
              </div>

            </div>

            {/* Right Column: Circular Photo Frame + Overlapping Decorations */}
            <div className="lg:col-span-6 flex items-center justify-center relative">
              <div className="relative w-[280px] sm:w-[340px] md:w-[380px] lg:w-[420px] aspect-square max-h-[calc(100dvh-180px)] flex items-center justify-center">
                
                {/* Large Circular Frame with Thick White Border */}
                <div className="relative w-full h-full rounded-full border-[10px] sm:border-[12px] lg:border-[14px] border-white bg-[#f8b825] shadow-2xl overflow-hidden flex items-center justify-center animate-float-gentle">
                  {userPhoto ? (
                    <img
                      src={userPhoto}
                      alt={fullUserName}
                      className="w-full h-full object-cover object-top scale-105 pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-amber-400 to-amber-200 text-[#2b0066] p-4 text-center">
                      <span className="text-6xl sm:text-7xl mb-2">🎉</span>
                      <span className="font-black text-xl sm:text-2xl">{fullUserName}</span>
                      <span className="text-xs font-extrabold text-[#2b0066]/70 uppercase tracking-widest mt-1">Paradigm Star</span>
                    </div>
                  )}
                </div>

                {/* Overlapping Gifts (Bottom Left) */}
                <div className="absolute -bottom-3 -left-3 sm:left-2 z-30 drop-shadow-2xl scale-90 sm:scale-100">
                  <svg width="190" height="130" viewBox="0 0 190 130" fill="none">
                    <rect x="40" y="40" width="75" height="70" rx="8" fill="#00c4cc" />
                    <rect x="70" y="40" width="15" height="70" fill="#ff3385" />
                    <rect x="35" y="32" width="85" height="15" rx="5" fill="#00999f" />
                    <rect x="70" y="32" width="15" height="15" fill="#e01a6b" />
                    <path d="M65 18 C52 8, 42 28, 68 32 Z" fill="#ff3385" />
                    <path d="M92 18 C105 8, 115 28, 88 32 Z" fill="#ff3385" />
                    <circle cx="78" cy="30" r="5" fill="#e01a6b" />
                    <rect x="80" y="70" width="85" height="50" rx="6" fill="#ffb703" />
                    <rect x="115" y="70" width="15" height="50" fill="#6d28d9" />
                    <rect x="75" y="62" width="95" height="14" rx="4" fill="#fb8500" />
                    <rect x="115" y="62" width="15" height="14" fill="#5b21b6" />
                    <path d="M110 50 C100 42, 92 58, 114 62 Z" fill="#6d28d9" />
                    <path d="M135 50 C145 42, 153 58, 131 62 Z" fill="#6d28d9" />
                    <circle cx="122.5" cy="60" r="4.5" fill="#4c1d95" />
                  </svg>
                </div>

                {/* Floating Balloon (Top Right) */}
                <div className="absolute -top-5 -right-2 sm:right-4 z-30 animate-balloon-sway scale-90 sm:scale-100">
                  <svg width="100" height="145" viewBox="0 0 95 140" fill="none">
                    <path d="M47 88 Q40 110 47 135" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" fill="none" opacity="0.8" />
                    <ellipse cx="47" cy="46" rx="36" ry="42" fill="#ff3385" />
                    <ellipse cx="36" cy="32" rx="9" ry="16" fill="#ffffff" opacity="0.4" />
                    <polygon points="44,86 50,86 47,91" fill="#e01a6b" />
                  </svg>
                </div>

                {/* Cake Slice with Candle (Bottom Right) */}
                <div className="absolute -bottom-2 -right-2 sm:right-2 z-30 drop-shadow-xl scale-90 sm:scale-100">
                  <svg width="130" height="110" viewBox="0 0 130 110" fill="none">
                    <ellipse cx="65" cy="98" rx="55" ry="10" fill="#00c4cc" />
                    <path d="M25 78 L80 92 L115 62 L60 48 Z" fill="#3b0f66" />
                    <path d="M25 78 L80 92 L80 60 L25 46 Z" fill="#ff3385" />
                    <path d="M25 46 L80 60 L115 30 L60 16 Z" fill="#ff3385" />
                    <circle cx="48" cy="65" r="2.5" fill="#ffffff" />
                    <circle cx="62" cy="68" r="2.5" fill="#ffffff" />
                    <path d="M52 71 Q55 75 58 72" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    <rect x="76" y="24" width="6" height="28" rx="2" fill="#00c4cc" />
                    <path d="M79 18 C79 12, 81 8, 81 3 C81 8, 83 12, 83 18 C83 20, 79 20, 79 18 Z" fill="#fbbf24" className="animate-pulse" />
                  </svg>
                </div>

              </div>
            </div>

          </div>
          ) : (
          /* ── Dedicated Colleagues' Wishes Wall View ── */
          <div className="relative z-20 flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>💌</span>
                  <span>Colleagues' Birthday Wishes Wall</span>
                </h3>
                <p className="text-xs sm:text-sm text-white/70 font-medium">
                  Warm greetings and blessings sent by your team across Paradigm today
                </p>
              </div>

              <button
                type="button"
                onClick={fetchWishes}
                disabled={isLoadingWishes}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>Refresh</span>
                <span>🔄</span>
              </button>
            </div>

            {isLoadingWishes ? (
              <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
                <Sparkles className="w-5 h-5 animate-spin mr-2 text-amber-300" /> Loading wishes...
              </div>
            ) : wishes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-3xl mb-3 border border-white/15 shadow-inner">
                  🎂
                </div>
                <h4 className="text-lg font-black">No Wishes Received Yet Today</h4>
                <p className="text-xs text-white/70 max-w-md mt-1 leading-relaxed">
                  Colleagues across the company are receiving their morning birthday notification today. As they send their wishes, they will appear right here!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {wishes.map((w) => {
                  const isThanked = thankedWishIds.has(w.id) || !!w.reaction;
                  return (
                    <div
                      key={w.id}
                      className="p-4 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center overflow-hidden shrink-0">
                          {w.sender_photo_url ? (
                            <img src={w.sender_photo_url} alt={w.sender_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-black text-amber-300 text-xs">{(w.sender_name || 'C')[0]}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-black text-sm text-white truncate leading-tight">
                            {w.sender_name}
                          </h5>
                          <p className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider truncate">
                            {w.sender_role || 'Colleague'}
                          </p>
                        </div>
                      </div>

                      <div className="relative p-3 rounded-xl bg-black/20 border border-white/5 text-xs text-white/95 leading-relaxed font-medium">
                        "{w.message}"
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-white/50 font-medium">
                          {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {isThanked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-400/30">
                            <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                            <span>Thanked 🙏</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleThankColleague(w)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 px-3 py-1 rounded-full shadow-xs active:scale-95 transition cursor-pointer"
                          >
                            <Heart className="w-3 h-3" />
                            <span>Say Thank You 🙏</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* ── Bottom Compliance Bar (Full Bleed Edge-to-Edge) ── */}
          <footer className="relative z-30 px-6 sm:px-10 lg:px-16 py-3 border-t border-white/10 bg-black/15 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/60 gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Dedicated to: <strong className="text-white font-bold">{fullUserName}</strong> • {userRole} ({userSite})</span>
            </div>

            <div className="flex items-center gap-4">
              <span>ISO 9001:2015 Cultural Governance</span>
              <span>•</span>
              <button
                onClick={handleDismiss}
                className="text-amber-300 hover:text-white font-bold cursor-pointer underline underline-offset-2"
              >
                Continue to Paradigm Workspace →
              </button>
            </div>
          </footer>

        </div>
      )}

    </div>
  );
};

export default BirthdayCelebrationModal;
