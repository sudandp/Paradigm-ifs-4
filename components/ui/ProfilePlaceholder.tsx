
import React, { useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Avatars } from './Avatars';
import { supabase } from '../../services/supabase';
import { getProxyUrl } from '../../utils/fileUrl';
import { BlurhashImage } from './BlurhashImage';

interface ProfilePlaceholderProps {
    className?: string;
    photoUrl?: string | null;
    seed?: string;
    blurhash?: string | null;
}

export const ProfilePlaceholder: React.FC<ProfilePlaceholderProps> = ({ className, photoUrl, seed, blurhash }) => {
    const { user } = useAuthStore();
    const [imgError, setImgError] = useState(false);

    // Synchronously resolve external URLs if possible to prevent loading flicker
    const initialResolvedPhoto = useMemo(() => {
        if (!photoUrl) return null;
        if (
            photoUrl.startsWith('http') || 
            photoUrl.startsWith('https') || 
            photoUrl.startsWith('data:') ||
            photoUrl.startsWith('/api/') ||
            photoUrl.startsWith('./') ||
            photoUrl.startsWith('blob:')
        ) {
            return getProxyUrl(photoUrl);
        }
        return null;
    }, [photoUrl]);

    const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(initialResolvedPhoto);
    const [isLoading, setIsLoading] = useState(!initialResolvedPhoto);

    // Reset states and resolve asynchronously if needed when photoUrl or seed changes
    React.useEffect(() => {
        setImgError(false);
        
        // If we already resolved it synchronously, no need to trigger loading or async resolution
        if (photoUrl && initialResolvedPhoto) {
            setResolvedPhoto(initialResolvedPhoto);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        let active = true;

        const resolve = async () => {
            if (photoUrl) {
                // Handle storage paths (e.g., 'avatars/xyz.jpg')
                try {
                    const isAvatar = photoUrl.startsWith('avatars/');
                    const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
                    const path = isAvatar ? photoUrl.replace('avatars/', '') : photoUrl;
                    
                    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
                    const finalUrl = getProxyUrl(data.publicUrl);
                    if (active) {
                        setResolvedPhoto(finalUrl);
                    }
                } catch (err) {
                    console.warn('Failed to resolve photo URL path:', photoUrl, err);
                    if (active) {
                        setResolvedPhoto(null);
                        setIsLoading(false);
                    }
                    return;
                }
            } else if (seed && seed.length === 36) { // standard UUID check
                // Try fetching user photo_url from Supabase database
                try {
                    const { data: dbUser, error } = await supabase
                        .from('users')
                        .select('photo_url')
                        .eq('id', seed)
                        .maybeSingle();

                    if (!error && dbUser?.photo_url) {
                        const dbPhotoUrl = dbUser.photo_url;
                        let finalUrl = dbPhotoUrl;
                        if (
                            dbPhotoUrl.startsWith('http') || 
                            dbPhotoUrl.startsWith('https') || 
                            dbPhotoUrl.startsWith('data:') ||
                            dbPhotoUrl.startsWith('/api/') ||
                            dbPhotoUrl.startsWith('./') ||
                            dbPhotoUrl.startsWith('blob:')
                        ) {
                            finalUrl = getProxyUrl(dbPhotoUrl);
                        } else {
                            const isAvatar = dbPhotoUrl.startsWith('avatars/');
                            const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
                            const path = isAvatar ? dbPhotoUrl.replace('avatars/', '') : dbPhotoUrl;
                            
                            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
                            finalUrl = getProxyUrl(data.publicUrl);
                        }
                        if (active) {
                            setResolvedPhoto(finalUrl);
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('Failed to fetch user photo for seed:', seed, err);
                }
                
                // Fallback: Check if the seed is the current logged-in user and has Google photo
                try {
                    const { data: authData } = await supabase.auth.getUser();
                    if (authData?.user && authData.user.id === seed) {
                        const googlePhoto = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture;
                        if (googlePhoto) {
                            if (active) {
                                setResolvedPhoto(getProxyUrl(googlePhoto));
                                return;
                            }
                        }
                    }
                } catch (authErr) {
                    // Ignore
                }

                if (active) {
                    setResolvedPhoto(null);
                    setIsLoading(false);
                }
            } else {
                if (active) {
                    setResolvedPhoto(null);
                    setIsLoading(false);
                }
            }
        };

        resolve();
        return () => { active = false; };
    }, [photoUrl, seed, initialResolvedPhoto]);

    // Pre-load image to handle errors and loading state
    React.useEffect(() => {
        if (!resolvedPhoto) {
            setIsLoading(false);
            return;
        }
        
        const img = new Image();
        img.src = resolvedPhoto;
        img.onload = () => {
            setImgError(false);
            setIsLoading(false);
        };
        img.onerror = () => {
            setImgError(true);
            setIsLoading(false);
        };
    }, [resolvedPhoto]);

    // Fallback Avatar with deterministic soft background
    const DefaultAvatar = Avatars[0];

    if (resolvedPhoto && !imgError) {
        return (
            <BlurhashImage
                src={resolvedPhoto}
                blurhash={blurhash}
                seed={seed || resolvedPhoto}
                alt="Profile"
                className={`flex-shrink-0 rounded-inherit ${className || 'w-full h-full'}`}
                imgClassName="w-full h-full object-cover"
                fallbackIcon={<DefaultAvatar className="w-full h-full" />}
            />
        );
    }

    return (
        <div className={`relative overflow-hidden rounded-inherit ${className || 'w-full h-full'}`}>
            <DefaultAvatar className="w-full h-full" />
            {isLoading && (
                <BlurhashImage
                    blurhash={blurhash}
                    seed={seed || 'loading-avatar'}
                    className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
                />
            )}
        </div>
    );
};