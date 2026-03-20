import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Logo from '../ui/Logo';
import { useAuthLayoutStore } from '../../store/authLayoutStore';
import { Download } from 'lucide-react';
import AppDownloadModal from '../ui/AppDownloadModal';

const AuthLayout: React.FC = () => {
    const { backgroundImages } = useAuthLayoutStore();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Only run the interval if there's more than one image to cycle through
        if (backgroundImages.length > 1) {
            const timer = setInterval(() => {
                setCurrentImageIndex(prevIndex => (prevIndex + 1) % backgroundImages.length);
            }, 5000); // Change image every 5 seconds
            return () => clearInterval(timer);
        }
    }, [backgroundImages.length]);

    const properties = useMemo(() => {
        if (backgroundImages && backgroundImages.length > 0) {
            return backgroundImages;
        }
        // Provide a default fallback if the store is empty for some reason
        return ['https://picsum.photos/seed/default_fallback_1/1200/900'];
    }, [backgroundImages]);

    const pageInfo = useMemo(() => {
        if (location.pathname.includes('signup')) {
            return { title: 'Create an Account', subtitle: 'Join our platform to get started.' };
        }
        if (location.pathname.includes('forgot-password')) {
            return { title: 'Forgot Password?', subtitle: 'No worries, we\'ll send you reset instructions.' };
        }
        if (location.pathname.includes('update-password')) {
            return { title: 'Set a New Password', subtitle: 'Please enter your new password.' };
        }
        if (location.pathname.includes('logout')) {
            return { title: 'Log Out', subtitle: 'Are you sure you want to log out? You will need to sign in again to access your account.' };
        }
        // Default to login
        return { title: 'Sign In', subtitle: 'Enter your credentials to access your account.' };
    }, [location.pathname]);


    return (
        <div className="min-h-screen font-sans flex items-center justify-center bg-page relative">
            {/* Full-screen background carousel */}
            <div className="fixed inset-0 w-full h-full">
                {properties.map((imageUrl, index) => (
                    <img
                        key={index}
                        src={imageUrl}
                        alt={`Background ${index + 1}`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                            }`}
                        onError={(e) => {
                           const target = e.target as HTMLImageElement;
                           target.style.display = 'none'; // simple fallback: hide broken images
                           
                           // Auto-clean: Remove this broken image from the store if it's not a default one containing 'picsum'
                           // We use a small timeout to avoid state updates during render
                           if (!imageUrl.includes('picsum.photos')) {
                               setTimeout(() => {
                                   useAuthLayoutStore.getState().removeBackgroundImage(index);
                               }, 0);
                           }
                        }}
                    />
                ))}
                <div className="absolute inset-0 bg-black/30"></div> {/* Dark overlay */}
            </div>

            {/* Centered content container */}
            <div className="relative w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl p-4 py-10 md:py-16">
                <div className="auth-card-container glass-mobile w-full grid md:grid-cols-2 rounded-2xl shadow-2xl overflow-hidden md:backdrop-blur-none md:bg-[#0d2c18] border border-[#041b0f] md:border-white/10">
                    {/* Left Visual Column */}
                    <div className="hidden md:flex flex-col justify-between p-6 lg:p-10 xl:p-16 bg-gradient-to-br from-black/40 to-black/70">
                        <div>
                            <Logo className="h-8 lg:h-12 xl:h-14" />
                            <h1 className="text-xl lg:text-2xl xl:text-4xl font-bold text-white mt-6 lg:mt-8 leading-tight drop-shadow-lg">
                                Welcome to the Future of Onboarding.
                            </h1>
                            <p className="text-white/80 mt-4 max-w-md drop-shadow-lg text-xs lg:text-sm xl:text-base">
                                Streamlining the journey for every new member of the Paradigm family.
                            </p>
                        </div>

                        <div>
                            <p className="text-white/50 text-[10px] lg:text-xs mt-4">© {new Date().getFullYear()} Paradigm Services. All rights reserved.</p>
                        </div>
                    </div>

                    {/* Right Form Column with Glassmorphism effect */}
                    <div className="p-6 lg:p-10 xl:p-16 flex flex-col justify-center bg-[#050505]/85 backdrop-blur-xl border-l border-white/10">
                        <div className="w-full max-w-md mx-auto">
                            {/* Mobile Logo Visibility Fix */}
                            <div className="flex justify-center mb-6">
                                <Logo className="h-10 lg:h-12" />
                            </div>
                            <h2 className="text-xl lg:text-2xl xl:text-3xl font-bold text-white mb-2">{pageInfo.title}</h2>
                            <p className="text-gray-300 mb-4 lg:mb-6 xl:mb-8 text-xs lg:text-sm xl:text-base">{pageInfo.subtitle}</p>
                            <Outlet />
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Download Button */}
            <button 
                onClick={() => setIsDownloadModalOpen(true)}
                className="fixed bottom-6 left-6 w-16 h-16 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center z-50 group border border-white/20"
                title="Download App"
            >
                <Download className="w-8 h-8 group-hover:bounce text-white" />
            </button>

            {/* Download Modal */}
            <AppDownloadModal 
                isOpen={isDownloadModalOpen} 
                onClose={() => setIsDownloadModalOpen(false)} 
            />
        </div>
    );
};

export default AuthLayout;