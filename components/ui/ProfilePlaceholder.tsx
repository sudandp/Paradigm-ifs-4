
import React, { useMemo } from 'react';
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

    const resolvedPhotoUrl = useMemo(() => {
        if (!photoUrl) return null;
        
        // If it's already a full URL, return it
        if (photoUrl.startsWith('http') || photoUrl.startsWith('https') || photoUrl.startsWith('data:')) {
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

    if (resolvedPhotoUrl) {
        return (
            <img 
                src={resolvedPhotoUrl} 
                alt="Profile" 
                className={`object-cover ${className || ''}`} 
                onError={(e) => (e.currentTarget.style.display = 'none')} 
            />
        );
    }

    const effectiveSeed = seed || user?.id;

    if (!effectiveSeed) {
        const FallbackAvatar = Avatars[0];
        return <FallbackAvatar className={`text-muted/60 ${className || ''}`} />;
    }

    const avatarIndex = effectiveSeed.charCodeAt(effectiveSeed.length - 1) % Avatars.length;
    const SelectedAvatar = Avatars[avatarIndex];

    return <SelectedAvatar className={className || ''} />;
};