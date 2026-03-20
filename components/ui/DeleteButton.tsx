import React from 'react';
import { Trash2 } from 'lucide-react';
import Button from './Button';

interface DeleteButtonProps {
    onClick: () => void;
    ariaLabel?: string;
    title?: string;
    disabled?: boolean;
    className?: string;
}

/**
 * Standardized delete button component with consistent styling across the app
 * Uses the design pattern from AttendanceSettings with proper spacing and hover states
 */
const DeleteButton: React.FC<DeleteButtonProps> = ({
    onClick,
    ariaLabel = "Delete",
    title = "Delete",
    disabled = false,
    className = ""
}) => {
    return (
        <Button
            variant="icon"
            onClick={onClick}
            aria-label={ariaLabel}
            title={title}
            disabled={disabled}
            className={`p-2 hover:bg-red-500/10 rounded-full transition-colors ${className}`}
        >
            <Trash2 className="h-5 w-5 text-red-500" />
        </Button>
    );
};

export default DeleteButton;
