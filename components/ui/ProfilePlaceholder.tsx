
import React, { useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Avatars } from './Avatars';
import { supabase } from '../../services/supabase';

interface ProfilePlaceholderProps {
    className?: string;
    photoUrl?: string | null;
    seed?: string;
}

export const ProfilePlaceholder: React.FC<ProfilePlaceholderProps> = ({ className, photoUrl, seed }) => {
    const { user } = useAuthStore();
    const [imgError, setImgError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Reset states if the URL changes
    React.useEffect(() => {
        setImgError(false);
        if (photoUrl) setIsLoading(true);
        else setIsLoading(false);
    }, [photoUrl]);

    const resolvedPhotoUrl = useMemo(() => {
        if (!photoUrl) return null;
        
        // If it's already a full URL or a relative proxy URL, return it
        if (
            photoUrl.startsWith('http') || 
            photoUrl.startsWith('https') || 
            photoUrl.startsWith('data:') ||
            photoUrl.startsWith('/api/') ||
            photoUrl.startsWith('./') ||
            photoUrl.startsWith('blob:')
        ) {
            return photoUrl;
        }

        // Handle storage paths (e.g., 'avatars/xyz.jpg' or '123/documents/...')
        try {
            const isAvatar = photoUrl.startsWith('avatars/');
            const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
            const path = isAvatar ? photoUrl.replace('avatars/', '') : photoUrl;
            
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            return data.publicUrl;
        } catch (err) {
            console.warn('Failed to resolve photo URL path:', photoUrl, err);
            return null;
        }
    }, [photoUrl]);

    // Pre-load image to handle errors and loading state
    React.useEffect(() => {
        if (!resolvedPhotoUrl) {
            setIsLoading(false);
            return;
        }
        
        const img = new Image();
        img.src = resolvedPhotoUrl;
        img.onload = () => {
            setImgError(false);
            setIsLoading(false);
        };
        img.onerror = () => {
            setImgError(true);
            setIsLoading(false);
        };
    }, [resolvedPhotoUrl]);

    // Show the user's photo if we have one and it loaded successfully
    if (resolvedPhotoUrl && !imgError && !isLoading) {
        // Escape URL for CSS
        const escapedUrl = resolvedPhotoUrl.replace(/'/g, "\\'");
        return (
            <div 
                className={`flex-shrink-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300 ${className || 'w-full h-full'}`}
                style={{ backgroundImage: `url('${escapedUrl}')` }}
                aria-label="Profile"
            />
        );
    }

    // While loading or on error/no photo, show the DefaultAvatar
    // We can add a subtle pulse effect while loading
    const DefaultAvatar = Avatars[0];
    return (
        <div className={`relative ${className || 'w-full h-full'}`}>
            <DefaultAvatar className="w-full h-full" />
            {isLoading && (
                <div className="absolute inset-0 bg-white/10 animate-pulse rounded-inherit" />
            )}
        </div>
    );
};