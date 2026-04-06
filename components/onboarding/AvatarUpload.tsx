import React, { useState, useCallback, useRef } from 'react';
import type { UploadedFile } from '../../types';
import { Edit, Trash2, Loader2, AlertTriangle, Camera } from 'lucide-react';
import { ProfilePlaceholder } from '../ui/ProfilePlaceholder';
import Button from '../ui/Button';
import CameraCaptureModal from '../CameraCaptureModal';
import { Capacitor } from '@capacitor/core';

interface AvatarUploadProps {
  file: UploadedFile | undefined | null;
  onFileChange: (file: UploadedFile | null) => void;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ file, onFileChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // For the preview modal after native camera capture
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check if we're in the custom Android WebView wrapper
  const isAndroidWrapper = navigator.userAgent.includes('ParadigmApp');
  const isNative = Capacitor.isNativePlatform() || isAndroidWrapper;

  const handleFileSelect = useCallback(async (selectedFile: File, base64FromCapture?: string) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setError('');
      const preview = base64FromCapture ? `data:${selectedFile.type};base64,${base64FromCapture}` : URL.createObjectURL(selectedFile);
      const fileData: UploadedFile = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        preview,
        file: selectedFile,
      };
      onFileChange(fileData);
    }
  }, [onFileChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  // Handler for CameraCaptureModal's onCapture callback
  const handleCapture = useCallback(async (base64Image: string, mimeType: string) => {
    try {
      const byteString = atob(base64Image);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: mimeType });
      handleFileSelect(capturedFile, base64Image);
    } catch (err) {
      console.error("Error processing captured avatar:", err);
      setError("Failed to process captured photo.");
    }
  }, [handleFileSelect]);

  // ─── Native camera via HTML5 file input ───
  // This directly opens the native Android/iOS camera without any plugin
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setCapturedPreview(dataUrl);
      setIsCameraOpen(true);
      setIsLoading(false);
    };
    reader.onerror = () => {
      setError("Failed to read captured photo.");
      setIsLoading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleCaptureClick = () => {
    if (isNative) {
      // On native: use HTML5 file input with capture attribute
      // This directly opens the native camera app
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
        cameraInputRef.current.click();
      }
    } else {
      // On web browser: use the modern CameraCaptureModal
      setCapturedPreview(null);
      setIsCameraOpen(true);
    }
  };

  const handleRemove = () => {
    if (file && !file.preview.startsWith('data:')) {
      URL.revokeObjectURL(file.preview);
    }
    onFileChange(null);
    setError('');
  };

  const inputId = 'avatar-upload';

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Hidden camera input for native platforms — opens native camera directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleNativeCameraCapture}
        style={{ display: 'none' }}
      />

      {isCameraOpen && (
        <CameraCaptureModal
          isOpen={isCameraOpen}
          onClose={() => { setIsCameraOpen(false); setCapturedPreview(null); }}
          onCapture={handleCapture}
          captureGuidance="profile"
          initialImage={capturedPreview || undefined}
        />
      )}
      <div className="relative w-28 h-28 group">
        <div className={`
          w-full h-full rounded-2xl bg-page flex items-center justify-center overflow-hidden 
          border-2 transition-all duration-300 ring-4 ring-white shadow-xl
          ${error ? 'border-red-500' : 'border-accent/20 group-hover:border-accent/40'}
        `}>
          {isLoading ? (
            <div className="flex flex-col items-center text-muted">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
              <span className="text-xs mt-2 font-medium">Processing...</span>
            </div>
          ) : file?.preview ? (
            <img src={file.preview} alt="Profile preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <ProfilePlaceholder />
          )}
        </div>
        {file && !isLoading && (
          <button
            type="button"
            onClick={handleRemove}
            id="avatar-delete-button"
            className="avatar-delete-btn btn-icon absolute -top-2 -right-2 p-2 rounded-full transition-all !bg-white !text-red-600 shadow-lg hover:!bg-red-50 hover:scale-110 z-10"
            aria-label="Remove photo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <button id="avatar-hidden-capture-btn" className="hidden" onClick={handleCaptureClick} type="button"></button>
      <div className="flex items-center space-x-2 md:hidden">
        <label htmlFor={inputId} className={`w-32 h-10 cursor-pointer inline-flex items-center justify-center font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 rounded-full bg-accent text-white hover:bg-accent-dark focus:ring-accent text-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Edit className="w-4 h-4 mr-2" />
          {file ? 'Change' : 'Upload'}
        </label>
        <input id={inputId} name={inputId} type="file" className="sr-only" onChange={handleFileChange} accept="image/*" disabled={isLoading} />
        <button
          type="button"
          onClick={handleCaptureClick}
          disabled={isLoading}
          className={`avatar-capture-btn w-32 h-10 inline-flex items-center justify-center font-semibold rounded-full transition-colors duration-200 text-sm border border-red-200 !text-red-600 hover:!bg-red-50 !bg-card/70 backdrop-blur-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Camera className="w-4 h-4 mr-2" />
          Capture
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 text-center max-w-[160px] flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
};