
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

    const resolvedPhotoUrl = useMemo(() => {
        if (!photoUrl) return null;
        
        // If it's already a full URL or a relative proxy URL, return it
        if (
            photoUrl.startsWith('http') || 
            photoUrl.startsWith('https') || 
            photoUrl.startsWith('data:') ||
            photoUrl.startsWith('/api/') ||
            photoUrl.startsWith('./')
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

    // Show the user's photo if we have one and it loaded successfully
    if (resolvedPhotoUrl && !imgError) {
        return (
            <img 
                src={resolvedPhotoUrl} 
                alt="Profile" 
                className={`object-cover ${className || ''}`} 
                onError={() => setImgError(true)}
            />
        );
    }

    // No photo (or broken photo): always show the Paradigm default avatar
    const DefaultAvatar = Avatars[0];
    return <DefaultAvatar className={className || ''} />;
};