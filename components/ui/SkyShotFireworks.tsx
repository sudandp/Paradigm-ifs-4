import React, { useEffect, useRef } from 'react';

// Color palette matching the branding (excluding purple/indigo per guidelines)
const COLORS = [
    '#10b981', // Emerald green
    '#ef4444', // Red
    '#fbbf24', // Amber/Yellow
    '#38bdf8', // Sky Blue
    '#84cc16', // Lime green
];

export const SkyShotFireworks: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        // We set the canvas padding to allow fireworks to expand outside the button boundaries
        const paddingX = 100;
        const paddingY = 80;
        
        let width = canvas.width = 300;
        let height = canvas.height = 200;

        const updateSize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                width = canvas.width = rect.width + paddingX * 2;
                height = canvas.height = rect.height + paddingY * 2;
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);

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
                const speed = Math.random() * 3 + 1.2;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.alpha = 1;
                this.decay = Math.random() * 0.02 + 0.015;
                this.color = color;
                this.gravity = 0.035; // Soft gravity downward drag
                this.friction = 0.95; // Air resistance
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
                context.arc(this.x, this.y, 1.8, 0, Math.PI * 2);
                context.fillStyle = this.color;
                context.shadowBlur = 6;
                context.shadowColor = this.color;
                context.fill();
                context.restore();
            }
        }

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
                const speed = Math.random() * 2 + 5.5; // Swift vertical launch speed
                this.vx = (dx / distance) * speed;
                this.vy = (dy / distance) * speed;
                this.color = color;
                this.exploded = false;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                
                // Explode once rocket crosses target Y
                if (this.vy < 0 && this.y <= this.ty) {
                    this.exploded = true;
                }
            }

            draw(context: CanvasRenderingContext2D) {
                context.save();
                context.beginPath();
                context.arc(this.x, this.y, 2, 0, Math.PI * 2);
                context.fillStyle = this.color;
                context.shadowBlur = 8;
                context.shadowColor = this.color;
                context.fill();
                
                // Fine-line trailing spark
                context.beginPath();
                context.moveTo(this.x, this.y);
                context.lineTo(this.x - this.vx * 1.5, this.y - this.vy * 1.5);
                context.strokeStyle = this.color;
                context.lineWidth = 1;
                context.globalAlpha = 0.4;
                context.stroke();
                
                context.restore();
            }
        }

        const rockets: Rocket[] = [];
        const particles: Particle[] = [];

        let tick = 0;

        const loop = () => {
            ctx.clearRect(0, 0, width, height);

            tick++;

            // Launch a rocket more frequently to surround the button and highlight it
            if (tick % 45 === 0 || tick === 1) {
                const parent = canvas.parentElement;
                if (parent) {
                    const rect = parent.getBoundingClientRect();
                    const btnWidth = rect.width;
                    const btnHeight = rect.height;

                    const centerX = width / 2;
                    const centerY = height / 2;
                    
                    const btnLeft = centerX - btnWidth / 2;
                    const btnRight = centerX + btnWidth / 2;
                    const btnBottom = centerY + btnHeight / 2;

                    // Choose location to highlight around button: Left side, Right side, or Top/Center
                    const launchType = Math.floor(Math.random() * 3);
                    let sx = centerX;
                    let sy = btnBottom + 10;
                    let tx = centerX;
                    let ty = centerY - btnHeight / 2 - 20;

                    if (launchType === 0) {
                        // Explode on the left side to frame the left edge
                        sx = btnLeft - 15;
                        tx = btnLeft - 15 + (Math.random() * 10 - 5);
                        ty = centerY + (Math.random() * btnHeight - btnHeight / 2);
                    } else if (launchType === 1) {
                        // Explode on the right side to frame the right edge
                        sx = btnRight + 15;
                        tx = btnRight + 15 + (Math.random() * 10 - 5);
                        ty = centerY + (Math.random() * btnHeight - btnHeight / 2);
                    } else {
                        // Explode above the button to highlight the top
                        sx = centerX + (Math.random() * btnWidth - btnWidth / 2);
                        tx = sx + (Math.random() * 20 - 10);
                        ty = centerY - btnHeight / 2 - (Math.random() * 30 + 10);
                    }

                    // Bound checks to ensure they fit in canvas
                    sx = Math.max(10, Math.min(width - 10, sx));
                    tx = Math.max(10, Math.min(width - 10, tx));
                    sy = Math.max(10, Math.min(height - 10, sy));
                    ty = Math.max(10, Math.min(height - 10, ty));

                    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
                    rockets.push(new Rocket(sx, sy, tx, ty, color));
                }
            }

            // Update & draw rockets
            for (let i = rockets.length - 1; i >= 0; i--) {
                const r = rockets[i];
                r.update();
                r.draw(ctx);

                if (r.exploded) {
                    const count = Math.floor(Math.random() * 6) + 12; // 12 to 18 sparks per shell
                    for (let p = 0; p < count; p++) {
                        particles.push(new Particle(r.x, r.y, r.color));
                    }
                    rockets.splice(i, 1);
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
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute pointer-events-none z-0 overflow-visible"
            style={{
                top: '-80px',
                left: '-100px',
                width: 'calc(100% + 200px)',
                height: 'calc(100% + 160px)',
            }}
        />
    );
};

export default SkyShotFireworks;
