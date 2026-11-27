import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine, Type as TypeIcon, Eraser, Check, RotateCcw, Upload, Camera, ImageIcon } from 'lucide-react';
import type { UploadedFile } from '@/types';

type Mode = 'draw' | 'type' | 'upload';

interface Props {
    /** Current saved signature (biometrics.signatureImage). */
    value: UploadedFile | null | undefined;
    /** Candidate's full name — prefills the typed signature. */
    candidateName: string;
    onSave: (file: UploadedFile, mode: Mode) => void;
    onClear: () => void;
    /** Dark styling for the mobile flow. */
    dark?: boolean;
}

const CANVAS_W = 600;
const CANVAS_H = 200;

/** Handwriting-style fonts available on most systems; falls back to generic cursive. */
const TYPE_FONTS = [
    { id: 'script', label: 'Script', css: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' },
    { id: 'hand', label: 'Hand', css: '"Lucida Handwriting", "Bradley Hand", "Segoe Print", cursive' },
    { id: 'formal', label: 'Formal', css: '"Apple Chancery", "Monotype Corsiva", "URW Chancery L", serif' },
];

const dataUrlToFile = (dataUrl: string): UploadedFile => {
    const base64 = dataUrl.split(',')[1] || '';
    return {
        name: `signature_${Date.now()}.png`,
        type: 'image/png',
        size: Math.round((base64.length * 3) / 4),
        preview: dataUrl,
    };
};

/**
 * Draw an uploaded / photographed signature onto the canvas, fitted and centred,
 * turning the light paper background transparent and darkening the ink so it
 * prints cleanly on the forms.
 */
const renderUploadedImage = (canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const pad = 12;
    const scale = Math.min((CANVAS_W - pad * 2) / img.width, (CANVAS_H - pad * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    g.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);

    const frame = g.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const px = frame.data;
    // Estimate paper brightness from the image's brighter pixels, then key it out.
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) {
        if (px[i + 3] === 0) continue;
        const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (l > 120) { sum += l; n++; }
    }
    const paper = n ? sum / n : 230;
    const cutoff = paper - 45;
    for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] === 0) continue;
        const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (l >= cutoff) {
            px[i + 3] = 0; // background → transparent
        } else {
            const ink = Math.min(1, (cutoff - l) / 60);
            px[i] = 15; px[i + 1] = 23; px[i + 2] = 42; // slate-900 ink
            px[i + 3] = Math.round(255 * Math.max(0.35, ink));
        }
    }
    g.putImageData(frame, 0, 0);
};

/**
 * Candidate signature: draw on a pad (finger / mouse / stylus) or type the name in a
 * handwriting style. Produces a transparent PNG stored as biometrics.signatureImage,
 * which the booklet and compliance PDFs already render.
 */
const SignatureCapture: React.FC<Props> = ({ value, candidateName, onSave, onClear, dark }) => {
    const existing = value?.preview || (value as any)?.url || '';
    const [editing, setEditing] = useState(!existing);
    const [mode, setMode] = useState<Mode>('draw');
    const [typedName, setTypedName] = useState(candidateName);
    const [fontId, setFontId] = useState(TYPE_FONTS[0].id);
    const [hasInk, setHasInk] = useState(false);

    const [uploadError, setUploadError] = useState('');
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => { if (!typedName && candidateName) setTypedName(candidateName); }, [candidateName]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!existing) setEditing(true); }, [existing]);

    const ctx = () => {
        const c = canvasRef.current?.getContext('2d');
        if (c) {
            c.lineCap = 'round';
            c.lineJoin = 'round';
            c.strokeStyle = '#0f172a';
            c.lineWidth = 3;
        }
        return c;
    };

    const clearCanvas = useCallback(() => {
        const c = canvasRef.current;
        c?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H);
        setHasInk(false);
    }, []);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
            y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
        };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = point(e);
        const c = ctx();
        if (c && last.current) {
            c.beginPath();
            c.arc(last.current.x, last.current.y, 1.5, 0, Math.PI * 2);
            c.fillStyle = '#0f172a';
            c.fill();
        }
        setHasInk(true);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current || !last.current) return;
        const p = point(e);
        const c = ctx();
        if (!c) return;
        c.beginPath();
        c.moveTo(last.current.x, last.current.y);
        c.lineTo(p.x, p.y);
        c.stroke();
        last.current = p;
    };

    const endStroke = () => {
        drawing.current = false;
        last.current = null;
    };

    const renderTyped = useCallback(() => {
        const c = canvasRef.current;
        const g = c?.getContext('2d');
        if (!c || !g) return;
        g.clearRect(0, 0, CANVAS_W, CANVAS_H);
        const name = typedName.trim();
        if (!name) { setHasInk(false); return; }
        const font = TYPE_FONTS.find(f => f.id === fontId)?.css || 'cursive';
        let size = 72;
        g.font = `italic ${size}px ${font}`;
        while (g.measureText(name).width > CANVAS_W - 40 && size > 24) {
            size -= 4;
            g.font = `italic ${size}px ${font}`;
        }
        g.fillStyle = '#0f172a';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(name, CANVAS_W / 2, CANVAS_H / 2 + 6);
        setHasInk(true);
    }, [typedName, fontId]);

    // Re-render the typed preview whenever the text / style changes.
    useEffect(() => {
        if (editing && mode === 'type') renderTyped();
    }, [editing, mode, renderTyped]);

    const switchMode = (m: Mode) => {
        setMode(m);
        setUploadError('');
        clearCanvas();
    };

    const handleImageFile = (file: File | undefined) => {
        setUploadError('');
        if (!file) return;
        if (!file.type.startsWith('image/')) { setUploadError('Please choose an image file (JPG, PNG, HEIC).'); return; }
        if (file.size > 10 * 1024 * 1024) { setUploadError('Image is larger than 10 MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                if (canvasRef.current) {
                    renderUploadedImage(canvasRef.current, img);
                    setHasInk(true);
                }
            };
            img.onerror = () => setUploadError('Could not read this image. Try another photo.');
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    const save = () => {
        const c = canvasRef.current;
        if (!c || !hasInk) return;
        onSave(dataUrlToFile(c.toDataURL('image/png')), mode);
        setEditing(false);
    };

    const surface = dark ? 'bg-slate-800/80 border-slate-700' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800';
    const muted = dark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
    const strong = dark ? 'text-white' : 'text-slate-900 dark:text-white';

    // ── Saved state ──
    if (existing && !editing) {
        return (
            <div className={`p-4 rounded-xl border ${surface}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <h3 className={`text-sm font-semibold ${strong}`}>Candidate signature</h3>
                        <p className={`text-xs ${muted}`}>This signature is printed on the onboarding forms.</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="w-4 h-4" /> Signed
                    </span>
                </div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center h-28 max-w-xl">
                    <img src={existing} alt="Candidate signature" className="max-h-24 max-w-full object-contain" />
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                    <button type="button" onClick={() => { setEditing(true); clearCanvas(); }} className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5" /> Sign again
                    </button>
                    <button type="button" onClick={() => { onClear(); clearCanvas(); setEditing(true); }} className={`${muted} hover:text-rose-600 cursor-pointer`}>
                        Remove
                    </button>
                </div>
            </div>
        );
    }

    // ── Capture state ──
    return (
        <div className={`p-4 rounded-xl border ${surface}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                    <h3 className={`text-sm font-semibold ${strong}`}>Candidate signature <span className="text-rose-500">*</span></h3>
                    <p className={`text-xs ${muted}`}>Required. Draw it, type the name, or take a photo of a signature on paper.</p>
                </div>
                <div className={`inline-flex p-0.5 rounded-lg border ${dark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`} role="radiogroup" aria-label="Signature method">
                    {([
                        { m: 'draw' as const, label: 'Draw', icon: PenLine },
                        { m: 'type' as const, label: 'Type', icon: TypeIcon },
                        { m: 'upload' as const, label: 'Upload', icon: Upload },
                    ]).map(opt => {
                        const on = mode === opt.m;
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.m}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => switchMode(opt.m)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    on ? 'bg-emerald-600 text-white shadow-sm' : muted
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" /> {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {mode === 'type' && (
                <div className="mb-3 flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                        placeholder="Candidate full name"
                        aria-label="Name for typed signature"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'}`}
                    />
                    <div className="flex gap-1">
                        {TYPE_FONTS.map(f => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFontId(f.id)}
                                className={`px-3 py-2 rounded-lg text-sm border cursor-pointer ${
                                    fontId === f.id
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                                style={{ fontFamily: f.css, fontStyle: 'italic' }}
                                title={`${f.label} style`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {mode === 'upload' && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }} />
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }} />
                    <button type="button" onClick={() => cameraInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                        <Camera className="w-4 h-4" /> Take photo
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${dark ? 'border-slate-600 text-slate-200' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <ImageIcon className="w-4 h-4" /> Choose image
                    </button>
                    <span className={`text-[11px] ${muted}`}>Sign on white paper with a dark pen. The background is removed automatically.</span>
                    {uploadError && <span className="w-full text-xs font-semibold text-rose-600">{uploadError}</span>}
                </div>
            )}

            <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white max-w-xl">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className={`w-full h-auto block ${mode === 'draw' ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
                    style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
                    onPointerDown={mode === 'draw' ? onPointerDown : undefined}
                    onPointerMove={mode === 'draw' ? onPointerMove : undefined}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onPointerCancel={endStroke}
                    aria-label={mode === 'draw' ? 'Signature pad — draw your signature' : 'Typed signature preview'}
                    role="img"
                />
                {!hasInk && mode !== 'type' && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400 text-center px-4">
                        {mode === 'draw' ? 'Sign here with finger, stylus or mouse' : 'Preview of the uploaded signature appears here'}
                    </span>
                )}
                <span className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-slate-300" />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 max-w-xl">
                <button
                    type="button"
                    onClick={() => { setUploadError(''); if (mode === 'type') setTypedName(''); else clearCanvas(); }}
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${muted} hover:text-rose-600 cursor-pointer`}
                >
                    <Eraser className="w-3.5 h-3.5" /> Clear
                </button>
                <div className="flex items-center gap-2">
                    {existing && (
                        <button type="button" onClick={() => setEditing(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${muted} cursor-pointer`}>
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={!hasInk}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <Check className="w-3.5 h-3.5" /> Use this signature
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignatureCapture;
