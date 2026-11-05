import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  angle: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  type: 'confetti' | 'circle' | 'star';
  opacity: number;
}

export const BirthdaySprinklesCanvas: React.FC = () => {
  const { user } = useAuthStore();
  const [fetchedDob, setFetchedDob] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check URL params for preview flag (?previewBirthday=true)
  useEffect(() => {
    const checkPreviewFlag = () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?')
        ? new URLSearchParams(window.location.hash.split('?')[1])
        : null;
      setIsPreview(
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
  }, []);

  // Fetch DOB dynamically if missing in cached session
  useEffect(() => {
    if (!user?.id) return;
    const existingDob = (user as any).date_of_birth || (user as any).dateOfBirth;
    if (existingDob) {
      setFetchedDob(existingDob);
      return;
    }

    let isMounted = true;
    const fetchDob = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('date_of_birth')
          .eq('id', user.id)
          .maybeSingle();

        if (isMounted && data?.date_of_birth) {
          setFetchedDob(data.date_of_birth);
        }
      } catch (e) {
        console.warn('[BirthdaySprinkles] DOB fetch notice:', e);
      }
    };
    fetchDob();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Is today user's birthday in IST or preview mode?
  const isBirthdayToday = useMemo(() => {
    if (isPreview) return true;
    if (!user) return false;

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
  }, [user, fetchedDob, isPreview]);

  // Canvas Sprinkles Particle Animation
  useEffect(() => {
    if (!isBirthdayToday) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight - 56);

    const colors = [
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#10b981', // Emerald
      '#06b6d4', // Cyan
      '#f43f5e', // Rose
      '#fbbf24', // Gold
      '#6366f1', // Indigo
    ];

    // Elegant, non-distracting quantity of sprinkles
    const particleCount = Math.min(Math.floor((width * height) / 22000), 55);
    const particles: Particle[] = [];

    const createParticle = (initialY = -1): Particle => {
      const types: Array<'confetti' | 'circle' | 'star'> = ['confetti', 'confetti', 'circle', 'star'];
      return {
        x: Math.random() * width,
        y: initialY === -1 ? Math.random() * height : -15,
        size: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 1.2 + 0.6, // Gentle drift
        speedX: Math.random() * 1.4 - 0.7,
        angle: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2.2,
        tilt: Math.random() * 10 - 10,
        tiltSpeed: Math.random() * 0.05 + 0.02,
        type: types[Math.floor(Math.random() * types.length)],
        opacity: Math.random() * 0.35 + 0.55, // 55% - 90% opacity for crisp yet soft appearance
      };
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
    }

    const drawStar = (x: number, y: number, r: number, color: string, alpha: number) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(
          x + Math.cos(((18 + i * 90) * Math.PI) / 180) * r,
          y + Math.sin(((18 + i * 90) * Math.PI) / 180) * r
        );
        ctx.lineTo(
          x + Math.cos(((63 + i * 90) * Math.PI) / 180) * (r * 0.35),
          y + Math.sin(((63 + i * 90) * Math.PI) / 180) * (r * 0.35)
        );
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    let isTabVisible = true;
    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const render = () => {
      if (isTabVisible) {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          p.y += p.speedY;
          p.x += Math.sin(p.y / 28) * 0.8 + p.speedX;
          p.angle += p.rotationSpeed;
          p.tilt += p.tiltSpeed;

          // Render based on shape
          if (p.type === 'star') {
            drawStar(p.x, p.y, p.size * 0.85, p.color, p.opacity);
          } else if (p.type === 'circle') {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            // Confetti rectangle with 3D flip flutter
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.angle * Math.PI) / 180);
            ctx.scale(1, Math.cos(p.tilt));
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.fillRect(-p.size / 2, -p.size * 0.8, p.size, p.size * 1.6);
            ctx.restore();
          }

          // Wrap around top when falling below screen
          if (p.y > height + 20) {
            particles[i] = createParticle(0);
          }
          if (p.x > width + 20) p.x = -15;
          if (p.x < -20) p.x = width + 15;
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!canvasRef.current) return;
      width = canvasRef.current.width = canvasRef.current.offsetWidth || window.innerWidth;
      height = canvasRef.current.height = canvasRef.current.offsetHeight || window.innerHeight - 56;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isBirthdayToday]);

  if (!isBirthdayToday) return null;

  return (
    <div
      className="fixed top-14 left-0 right-0 bottom-0 pointer-events-none z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default BirthdaySprinklesCanvas;

