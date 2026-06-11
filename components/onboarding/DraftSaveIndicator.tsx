import React from 'react';
import { Loader2, CheckCircle, Clock, Save } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export type DraftSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved';

interface DraftSaveIndicatorProps {
    status: DraftSaveStatus;
    lastSavedAt?: Date | null;
    onManualSave?: () => void;
    compact?: boolean; // true = icon only (for mobile footers)
}

const DraftSaveIndicator: React.FC<DraftSaveIndicatorProps> = ({
    status,
    lastSavedAt,
    onManualSave,
    compact = false,
}) => {
    if (status === 'idle') return null;

    const relativeTime = lastSavedAt
        ? formatDistanceToNow(lastSavedAt, { addSuffix: true })
        : null;

    if (compact) {
        return (
            <div className="flex items-center">
                {status === 'saving' && (
                    <span title="Saving draft...">
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                    </span>
                )}
                {status === 'saved' && (
                    <span title={`Draft saved${relativeTime ? ` · ${relativeTime}` : ''}`}>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </span>
                )}
                {status === 'dirty' && (
                    <span title="Unsaved changes">
                        <Clock className="h-4 w-4 text-amber-400" />
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm text-muted italic transition-all duration-300 min-h-[20px]">
            {status === 'saving' && (
                <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Saving draft...</span>
                </>
            )}
            {status === 'saved' && (
                <>
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600">
                        Draft saved{relativeTime ? ` · ${relativeTime}` : ''}
                    </span>
                </>
            )}
            {status === 'dirty' && (
                <>
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-amber-600">Unsaved changes</span>
                    {onManualSave && (
                        <button
                            type="button"
                            onClick={onManualSave}
                            className="flex items-center gap-1 text-accent hover:underline text-xs font-medium ml-1 transition-colors"
                        >
                            <Save className="h-3 w-3" />
                            Save now
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default DraftSaveIndicator;
