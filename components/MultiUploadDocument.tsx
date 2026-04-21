import React, { useState, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../utils/fileUrl';
import type { UploadedFile } from '../types';
import { 
  UploadCloud, 
  File as FileIcon, 
  X, 
  Trash2, 
  FileText, 
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import Button from './ui/Button';

interface MultiUploadDocumentProps {
  label: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  allowedTypes?: string[];
  error?: string;
  maxFiles?: number;
}

const MultiUploadDocument: React.FC<MultiUploadDocumentProps> = ({ 
    label,
    files = [],
    onFilesChange,
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    error,
    maxFiles = 999 // Effectively no limit for UI purposes
}) => {
    const navigate = useNavigate();
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;

        const newFiles: UploadedFile[] = [...files];
        const currentCount = files.length;
        
        for (let i = 0; i < selectedFiles.length; i++) {
            if (newFiles.length >= maxFiles) break;
            
            const file = selectedFiles[i];
            
            if (!allowedTypes.includes(file.type)) {
                continue; // Skip invalid types
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit for these docs
                continue; // Skip too large files
            }

            const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
            
            newFiles.push({
                name: file.name,
                type: file.type,
                size: file.size,
                preview,
                file: file
            });
        }

        onFilesChange(newFiles);
    }, [files, onFilesChange, allowedTypes, maxFiles]);

    const handleRemove = async (index: number) => {
        const removedFile = files[index];
        const isExistingFile = !(removedFile as any).file && ((removedFile as any).url || removedFile.preview?.startsWith('http') || removedFile.preview?.includes('/api/view-file/'));

        if (isExistingFile) {
            const confirmed = window.confirm("Are you sure you want to delete this file permanently from the server?");
            if (!confirmed) return;

            try {
                const fileUrl = (removedFile as any).url || removedFile.preview || '';
                await api.deleteFileFromStorage(fileUrl);
            } catch (err) {
                console.error("Failed to delete file:", err);
                window.alert("Failed to delete file from server.");
                return;
            }
        }

        const newFiles = [...files];
        if (removedFile.preview && removedFile.preview.startsWith('blob:')) {
            URL.revokeObjectURL(removedFile.preview);
        }
        newFiles.splice(index, 1);
        onFilesChange(newFiles);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const inputId = `multi-file-upload-${label.replace(/\s+/g, '-')}`;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-muted" htmlFor={inputId}>{label}</label>
                <div className="flex items-center gap-4">
                    {files.length > 0 && (
                        <button 
                            type="button" 
                            onClick={() => onFilesChange([])}
                            className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                        >
                            Remove All
                        </button>
                    )}
                    {maxFiles < 100 && <span className="text-xs text-muted">{files.length} / {maxFiles} files</span>}
                </div>
            </div>

            <div 
                className={`
                    relative w-full border-2 border-dashed rounded-2xl transition-all duration-300
                    ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-page/30'}
                    ${error ? 'border-red-500 bg-red-50/10' : ''}
                    p-6
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* File List */}
                {files.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {files.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group animate-in fade-in slide-in-from-bottom-2">
                                <div className="p-2 bg-accent/10 rounded-lg">
                                    {file.type.startsWith('image/') ? (
                                        <div className="w-8 h-8 rounded overflow-hidden">
                                            <img src={file.preview || (file as any).url} alt="preview" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <FileText className="w-8 h-8 text-accent" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-primary-text truncate" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-muted">
                                        {file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Existing Document'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(file.url || (file.preview && !file.preview.startsWith('blob:'))) && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const rawUrl = file.url || (file.preview && !file.preview.startsWith('blob:') ? file.preview : '');
                                                const proxyUrl = getProxyUrl(rawUrl);
                                                const cleanName = getCleanFilename(file.name || rawUrl);
                                                const params = new URLSearchParams({
                                                    url: proxyUrl,
                                                    title: cleanName
                                                });
                                                navigate(`/document-viewer?${params.toString()}`);
                                            }}
                                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="View Document"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemove(idx)}
                                        className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dropzone Area / Add More */}
                {files.length < maxFiles && (
                    <label 
                        htmlFor={inputId}
                        className="cursor-pointer flex flex-col items-center justify-center py-8 hover:opacity-80 transition-opacity"
                    >
                        <div className="p-4 bg-accent/10 rounded-full text-accent mb-3">
                            <UploadCloud className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-bold text-primary-text">
                            {files.length === 0 ? 'Click to upload or drag & drop' : 'Add more documents'}
                        </p>
                        <p className="text-xs text-muted mt-1 uppercase tracking-wider">
                            PNG, JPG, PDF Support
                        </p>
                    </label>
                )}

                {files.length >= maxFiles && (
                    <div className="text-center py-4 text-muted text-sm italic">
                        Maximum file limit reached ({maxFiles} files)
                    </div>
                )}
            </div>

            <input 
                id={inputId} 
                type="file" 
                multiple 
                className="sr-only" 
                onChange={(e) => handleFileSelect(e.target.files)} 
                accept={allowedTypes.join(',')}
            />

            {error && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
        </div>
    );
};

export default MultiUploadDocument;
