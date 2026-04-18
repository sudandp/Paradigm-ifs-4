import React from 'react';
import { Calendar } from 'lucide-react';

interface NativeDatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

const NativeDatePicker: React.FC<NativeDatePickerProps> = ({ label, error, className = '', ...props }) => {
    return (
        <div className="w-full flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 px-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500/70" /> {label}
            </label>
            <div className="relative group">
                <input
                    type="date"
                    {...props}
                    className={`
                        w-full p-4 rounded-xl bg-[#041b0f] border border-emerald-500/10 
                        text-white text-base font-medium outline-none transition-all
                        focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
                        placeholder:text-white/10 [color-scheme:dark]
                        ${error ? 'border-red-500/50' : ''}
                        ${className}
                    `}
                />
            </div>
            {error && <p className="text-[10px] text-red-400 font-bold px-1 tracking-wide">{error}</p>}
        </div>
    );
};

export default NativeDatePicker;
