import React, { useEffect, useRef } from 'react';

const FireworksBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        // --- Web Audio API Programmatic Sound Synthesis Engine ---
        let audioCtx: AudioContext | null = null;
        let noiseBuffer: AudioBuffer | null = null;

        const initAudio = () => {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        };

        const getNoiseBuffer = (c: AudioContext) => {
            if (noiseBuffer) return noiseBuffer;
            const bufferSize = c.sampleRate * 1.2; // 1.2 seconds of white noise
            const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noiseBuffer = buffer;
            return noiseBuffer;
        };

        const playLaunchSound = () => {
            initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            const c = audioCtx;
            const osc = c.createOscillator();
            osc.type = 'triangle';
            
            // Sweep frequency upward rapidly for the rising rocket whoosh
            osc.frequency.setValueAtTime(70, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(550, c.currentTime + 0.45);

            const gain = c.createGain();
            gain.gain.setValueAtTime(0.001, c.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);

            osc.connect(gain);
            gain.connect(c.destination);

            osc.start();
            osc.stop(c.currentTime + 0.5);
        };

        const playExplosionSound = () => {
            initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            const c = audioCtx;

            // 1. Deep Sub Thud (Triangle Low Pitch Sweep)
            const osc = c.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(65, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, c.currentTime + 0.3);

            const oscGain = c.createGain();
            oscGain.gain.setValueAtTime(0.35, c.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);

            osc.connect(oscGain);
            oscGain.connect(c.destination);
            osc.start();
            osc.stop(c.currentTime + 0.35);

            // 2. Filtered Rumble (White Noise decay)
            const noise = c.createBufferSource();
            noise.buffer = getNoiseBuffer(c);

            const filter = c.createBiquadFilter();
            filter.type = 'lowpass';
            // Slight randomization of boom pitch
            const cutoff = 150 + Math.random() * 80;
            filter.frequency.setValueAtTime(cutoff, c.currentTime);
            filter.Q.setValueAtTime(1.5, c.currentTime);

            const noiseGain = c.createGain();
            noiseGain.gain.setValueAtTime(0.3, c.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(c.destination);

            noise.start();
            noise.stop(c.currentTime + 0.95);

            // 3. Crackling Sparks (High Frequency Clicks)
            if (Math.random() > 0.3) {
                const sizzleCount = Math.floor(Math.random() * 4) + 3;
                for (let i = 0; i < sizzleCount; i++) {
                    const delay = 0.12 + Math.random() * 0.35;
                    const sizzle = c.createOscillator();
                    sizzle.type = 'sine';
                    sizzle.frequency.setValueAtTime(2500 + Math.random() * 2000, c.currentTime + delay);

                    const sizzleGain = c.createGain();
                    sizzleGain.gain.setValueAtTime(0.015, c.currentTime + delay);
                    sizzleGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + 0.035);

                    sizzle.connect(sizzleGain);
                    sizzleGain.connect(c.destination);

                    sizzle.start(c.currentTime + delay);
                    sizzle.stop(c.currentTime + delay + 0.04);
                }
            }
        };

        // Plays a silent node inside the user event call stack to fully authorize audio on iOS/Webkit
        const playSilentGesture = () => {
            initAudio();
            if (!audioCtx) return;
            const c = audioCtx;
            
            try {
                const osc = c.createOscillator();
                const gain = c.createGain();
                gain.gain.setValueAtTime(0, c.currentTime);
                osc.connect(gain);
                gain.connect(c.destination);
                
                osc.start(0);
                osc.stop(0.01);
            } catch (err) {
                console.warn("Silent audio gesture unlock failed", err);
            }
        };

        const handleInteraction = () => {
            playSilentGesture();
        };
        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);

        // Particle class representing explosion sparks
        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            alpha: number;
            decay: number;
            color: string;
            gravity: number;
            friction: number;

            constructor(x: number, y: number, color: string) {
                this.x = x;
                this.y = y;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 1.5;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.alpha = 1;
                this.decay = Math.random() * 0.015 + 0.012; // Beautiful fast-slow fade
                this.color = color;
                this.gravity = 0.06; // Light downward drag
                this.friction = 0.96; // Air resistance
            }

            update() {
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
            }

            draw(context: CanvasRenderingContext2D) {
                context.save();
                context.globalAlpha = this.alpha;
                context.beginPath();
                context.arc(this.x, this.y, 2, 0, Math.PI * 2);
                context.fillStyle = this.color;
                // Add soft glowing trails
                context.shadowBlur = 10;
                context.shadowColor = this.color;
                context.fill();
                context.restore();
            }
        }

        // Rocket class representing rising sky-shots
        class Rocket {
            x: number;
            y: number;
            sx: number;
            sy: number;
            tx: number;
            ty: number;
            vx: number;
            vy: number;
            color: string;
            exploded: boolean;

            constructor(sx: number, sy: number, tx: number, ty: number, color: string) {
                this.x = sx;
                this.y = sy;
                this.sx = sx;
                this.sy = sy;
                this.tx = tx;
                this.ty = ty;
                const dx = tx - sx;
                const dy = ty - sy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = Math.random() * 3 + 8; // High speed launch
                this.vx = (dx / distance) * speed;
                this.vy = (dy / distance) * speed;
                this.color = color;
                this.exploded = false;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                
                // Explode once rocket crosses or reaches target height
                if (this.vy < 0 && this.y <= this.ty) {
                    this.exploded = true;
                } else if (this.vy >= 0 && this.y >= this.ty) {
                    this.exploded = true;
                }
            }

            draw(context: CanvasRenderingContext2D) {
                context.save();
                context.beginPath();
                context.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
                context.fillStyle = this.color;
                context.shadowBlur = 12;
                context.shadowColor = this.color;
                context.fill();
                context.restore();
            }
        }

        const rockets: Rocket[] = [];
        const particles: Particle[] = [];

        // Beautiful vibrant colors for fireworks
        const colorPalette = [
            '#059669', // Emerald brand primary
            '#a3e635', // Lime brand accent
            '#eab308', // Radiant Gold
            '#f97316', // Orange flash
            '#ef4444', // Rose red warning
            '#06b6d4', // Cyan electric
        ];

        let tick = 0;

        const loop = () => {
            // White background clear with light opacity to create a clean ghosting tail fade
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(0, 0, width, height);

            tick++;

            // Launch a sky-shot periodically
            if (tick % 50 === 0 || tick === 1) {
                // Determine whether rocket goes to the top 15% or bottom 15% of screen
                const isTop = Math.random() > 0.4;
                const launchX = Math.random() * (width - 60) + 30;
                const startY = height + 10;
                
                let targetY = 0;
                if (isTop) {
                    // Explode in the top empty white space
                    targetY = Math.random() * (height * 0.15) + 30;
                } else {
                    // Explode in the bottom empty white space
                    targetY = height - (Math.random() * (height * 0.15) + 40);
                }

                const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                rockets.push(new Rocket(launchX, startY, launchX, targetY, color));
                
                // Play launch sweeping sound whoosh!
                playLaunchSound();
            }

            // Update & draw rockets
            for (let i = rockets.length - 1; i >= 0; i--) {
                const r = rockets[i];
                r.update();
                r.draw(ctx);

                if (r.exploded) {
                    // Burst particles!
                    const count = Math.floor(Math.random() * 25) + 30;
                    for (let p = 0; p < count; p++) {
                        particles.push(new Particle(r.x, r.y, r.color));
                    }
                    rockets.splice(i, 1);

                    // Play realistic detonation boom!
                    playExplosionSound();
                }
            }

            // Update & draw particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.update();
                p.draw(ctx);

                if (p.alpha <= 0) {
                    particles.splice(i, 1);
                }
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            cancelAnimationFrame(animationFrameId);
            if (audioCtx) {
                audioCtx.close();
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            style={{ mixBlendMode: 'multiply' }}
        />
    );
};

export default FireworksBackground;
