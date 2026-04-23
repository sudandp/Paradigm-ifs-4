import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLoadingScreenStore } from '../../store/loadingScreenStore';

import ReferralModal from '../modals/ReferralModal';

const MobileLayout: React.FC = () => {
    const store = useSettingsStore();
    const appVersion = store.apiSettings.appVersion || '1.0.0';
    const location = useLocation();
    const { fetchNotifications, isPanelOpen, setIsPanelOpen } = useNotificationStore();
    const { user } = useAuthStore();
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);
    const isFullScreenLoading = useLoadingScreenStore((s) => s.isFullScreenLoading);

    useEffect(() => {
        const handleScroll = () => {
            if (!ticking.current) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;

                    // Show header when scrolling up or at top
                    // Hide header IMMEDIATELY when scrolling down
                    if (currentScrollY < lastScrollY.current || currentScrollY < 10) {
                        setIsHeaderVisible(true);
                    } else if (currentScrollY > lastScrollY.current && currentScrollY > 10) {
                        // Hide immediately after scrolling down past 10px
                        setIsHeaderVisible(false);
                    }

                    lastScrollY.current = currentScrollY;
                    ticking.current = false;
                });
                ticking.current = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);

    return (
        <div className="flex flex-col min-h-screen bg-[#041b0f]">
            {/* Mobile Header - Auto-hide on scroll (FAST) */}
            {/* Hide global header for specific standalone pages like Apply for Leave or Site Attendance Tracker */}
             {!isFullScreenLoading &&
              !location.pathname.startsWith('/leaves/apply') && 
              !location.pathname.startsWith('/onboarding/aadhaar-scan') && 
              !location.pathname.startsWith('/finance/attendance/add') && 
              !location.pathname.startsWith('/finance/attendance/edit') && 
              !location.pathname.startsWith('/finance/site-tracker/add') && 
              !location.pathname.startsWith('/finance/site-tracker/edit') && 
              !location.pathname.startsWith('/referral/') && (
                <div
                    className={`fixed top-[calc(1.5rem+env(safe-area-inset-top))] left-4 right-4 z-50 max-w-md mx-auto transition-transform duration-300 ${
                        isHeaderVisible ? 'translate-y-0' : '-translate-y-[200%]'
                    }`}
                >
                    <Header />
                </div>
            )}

            {/* Main Content Area */}
            {/* Increased bottom padding by 30% (9.1rem = 7rem * 1.3) for more clearance */}
            <main
                className={`flex-1 overflow-y-auto ${
                    location.pathname.startsWith('/referral/') ? 'px-0 pt-0' : 'px-4 pt-[calc(7.5rem+env(safe-area-inset-top))]'
                }`}
                style={{ 
                    paddingBottom: (location.pathname.includes('/add') || location.pathname.includes('/edit') || location.pathname.startsWith('/referral/'))
                        ? 'env(safe-area-inset-bottom)' 
                        : 'calc(7rem + max(0.5rem, env(safe-area-inset-bottom)))' 
                }}
            >
                <Outlet />
                
                {/* App Version Footer */}
                {!isFullScreenLoading && (
                <div className="mt-8 mb-4 py-4 flex flex-col items-center justify-center opacity-30 select-none">
                    <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent mb-3" />
                    <p className="text-[10px] text-white font-semibold tracking-[0.15em] uppercase">
                        Paradigm v{appVersion}
                    </p>
                </div>
                )}
            </main>

            {/* Bottom Navigation */}
            {!isFullScreenLoading &&
             !location.pathname.includes('/add') && 
             !location.pathname.includes('/edit') && 
             !location.pathname.startsWith('/referral/') && (
                <BottomNav />
            )}

            {/* Notification Panel Overlay */}
            {isPanelOpen && (
                <div className="fixed inset-0 z-[100] animate-slide-in-right">
                    <NotificationPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} isMobile={true} />
                </div>
            )}

            {/* Referral Modal */}
            <ReferralModal />
        </div>
    );
};

export default MobileLayout;
