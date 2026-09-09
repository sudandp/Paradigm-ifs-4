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
import { APP_VERSION } from '../../src/config/appVersion';

const MobileLayout: React.FC = () => {
    const store = useSettingsStore();
    const appVersion = APP_VERSION || store.apiSettings.appVersion || '20.3.0';
    const location = useLocation();
    const { fetchNotifications, isPanelOpen, setIsPanelOpen } = useNotificationStore();
    const { user, isOffline } = useAuthStore();
    const isMobileHome = location.pathname === '/mobile-home' || location.pathname === '/';
    const [isHeaderVisible, setIsHeaderVisible] = useState(!isMobileHome);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);
    const isFullScreenLoading = useLoadingScreenStore((s) => s.isFullScreenLoading);
    const mainRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number | null>(null);
    const touchStartX = useRef<number | null>(null);
    const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial state per route: On MobileHome, start hidden as Image 1. On other pages, start visible.
    useEffect(() => {
        if (isMobileHome) {
            setIsHeaderVisible(false);
        } else {
            setIsHeaderVisible(true);
        }
        lastScrollY.current = 0;
        if (autoHideTimerRef.current) {
            clearTimeout(autoHideTimerRef.current);
            autoHideTimerRef.current = null;
        }
    }, [location.pathname, isMobileHome]);

    // Keep header visible if notification panel is open; auto-hide when closed if on MobileHome
    useEffect(() => {
        if (isPanelOpen) {
            if (autoHideTimerRef.current) {
                clearTimeout(autoHideTimerRef.current);
                autoHideTimerRef.current = null;
            }
            setIsHeaderVisible(true);
        } else if (isMobileHome && isHeaderVisible) {
            if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
            autoHideTimerRef.current = setTimeout(() => {
                setIsHeaderVisible(false);
            }, 2000);
        }
    }, [isPanelOpen, isMobileHome]);

    // Pull-down reveal handler
    const triggerPullReveal = React.useCallback(() => {
        setIsHeaderVisible(true);
        fetchNotifications();
        if (isMobileHome) {
            if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
            autoHideTimerRef.current = setTimeout(() => {
                if (!useNotificationStore.getState().isPanelOpen) {
                    setIsHeaderVisible(false);
                }
            }, 2600);
        }
    }, [isMobileHome, fetchNotifications]);

    // Pull-down gesture detection (Touch, Mouse drag, and Wheel)
    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touchStartY.current = e.touches[0].clientY;
                touchStartX.current = e.touches[0].clientX;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (touchStartY.current === null || touchStartX.current === null) return;
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = currentY - touchStartY.current;
            const diffX = Math.abs(currentX - touchStartX.current);

            // If at the very top and pulling down vertically
            if (el.scrollTop <= 5 && diffY > 30 && diffY > diffX * 1.2) {
                triggerPullReveal();
            }
        };

        const onTouchEnd = () => {
            touchStartY.current = null;
            touchStartX.current = null;
        };

        // Mouse drag support for DevTools emulation
        let isMouseDown = false;
        const onMouseDown = (e: MouseEvent) => {
            if (el.scrollTop <= 5) {
                isMouseDown = true;
                touchStartY.current = e.clientY;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isMouseDown || touchStartY.current === null) return;
            const diffY = e.clientY - touchStartY.current;
            if (el.scrollTop <= 5 && diffY > 30) {
                triggerPullReveal();
            }
        };

        const onMouseUp = () => {
            isMouseDown = false;
            touchStartY.current = null;
        };

        // Wheel event support when at top
        const onWheel = (e: WheelEvent) => {
            if (el.scrollTop <= 0 && e.deltaY < -20) {
                triggerPullReveal();
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        el.addEventListener('wheel', onWheel, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            el.removeEventListener('wheel', onWheel);
        };
    }, [triggerPullReveal]);

    // Scroll listener for auto-hiding
    useEffect(() => {
        const handleScroll = () => {
            if (!ticking.current && mainRef.current) {
                window.requestAnimationFrame(() => {
                    if (!mainRef.current) {
                        ticking.current = false;
                        return;
                    }
                    const currentScrollY = mainRef.current.scrollTop;
                    
                    if (isMobileHome) {
                        // On MobileHome, hide header as soon as user scrolls down
                        if (currentScrollY > 15) {
                            setIsHeaderVisible(false);
                            if (autoHideTimerRef.current) {
                                clearTimeout(autoHideTimerRef.current);
                                autoHideTimerRef.current = null;
                            }
                        }
                    } else {
                        // On other pages, show when at the top, hide when scrolling down
                        if (currentScrollY <= 20) {
                            setIsHeaderVisible(true);
                        } else {
                            setIsHeaderVisible(false);
                        }
                    }

                    lastScrollY.current = currentScrollY;
                    ticking.current = false;
                });
                ticking.current = true;
            }
        };

        const mainElement = mainRef.current;
        if (mainElement) {
            mainElement.addEventListener('scroll', handleScroll, { passive: true });
        }
        return () => {
            if (mainElement) {
                mainElement.removeEventListener('scroll', handleScroll);
            }
        };
    }, [isMobileHome]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#041b0f]">

            {/* Mobile Header - Auto-hide on scroll & pull-down reveal */}
             {!isFullScreenLoading && !isOffline &&
              !location.pathname.startsWith('/leaves/apply') && 
              !location.pathname.startsWith('/onboarding/aadhaar-scan') && 
              !location.pathname.startsWith('/finance/attendance/add') && 
              !location.pathname.startsWith('/finance/attendance/edit') && 
              !location.pathname.startsWith('/finance/site-tracker/add') && 
              !location.pathname.startsWith('/finance/site-tracker/edit') && 
              !location.pathname.startsWith('/referral/') && (
                <div
                    className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out pointer-events-none ${
                        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
                    }`}
                >
                    <div className="bg-transparent pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1 px-4 max-w-md mx-auto">
                        <Header />
                    </div>
                </div>
            )}

            <main
                ref={mainRef}
                className={`flex-1 overflow-y-auto transition-[padding] duration-300 ease-out ${
                    location.pathname.startsWith('/referral/') 
                        ? 'px-0 pt-0' 
                        : isMobileHome
                            ? (isHeaderVisible ? 'px-0 pt-[calc(4.5rem+env(safe-area-inset-top))]' : 'px-0 pt-0')
                            : 'px-0 pt-[calc(6.5rem+env(safe-area-inset-top))]'
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
                <div className="mt-8 mb-4 py-4 flex flex-col items-center justify-center opacity-30 select-none text-center">
                    <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent mb-3" />
                    <p className="text-[9px] text-white font-semibold tracking-[0.1em] uppercase mb-1">
                        Paradigm FMS Services v{appVersion}
                    </p>
                    <p className="text-[8px] text-white/70 tracking-normal leading-relaxed">
                        © All rights reserved. Developed by Sudhan<br />
                        <a href="mailto:sudhan@paradigmfms.com" className="active:text-emerald-400">sudhan@paradigmfms.com</a>
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
