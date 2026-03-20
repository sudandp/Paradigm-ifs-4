
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import { AlertCircle, Bell, CheckCircle, Clock, MapPin, Navigation, User } from 'lucide-react';
import Button from '../ui/Button';
import { formatDistanceToNow, parseISO } from 'date-fns';

const ALARM_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3';
const ALARM_TIMEOUT_MS = 120000; // 2 minutes

export const PingAlarmOverlay: React.FC = () => {
    const { notifications, acknowledgeNotification } = useNotificationStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Find unacknowledged direct pings that are less than 2 minutes old
    const activePings = useMemo(() => {
        return notifications.filter(n => 
            n.type === 'direct_ping' && 
            !n.acknowledgedAt && 
            (new Date().getTime() - new Date(n.createdAt).getTime()) < ALARM_TIMEOUT_MS
        );
    }, [notifications, currentTime]);

    const activePing = activePings[0]; // Logic: handle the most recent unacknowledged ping

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 5000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (activePing) {
            if (!audioRef.current) {
                audioRef.current = new Audio(ALARM_SOUND_URL);
                audioRef.current.loop = true;
            }
            audioRef.current.play().catch(err => console.warn('Audio playback blocked:', err));
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
    }, [activePing]);

    if (!activePing) return null;

    const metadata = activePing.metadata || {};
    const senderName = metadata.senderName || 'Nearby Staff';
    const locationName = metadata.locationName || 'Your Location';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-red-500 animate-bounce-subtle">
                {/* Header Decoration */}
                <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
                
                <div className="p-8 text-center">
                    <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150"></div>
                        <div className="relative bg-red-500 text-white p-5 rounded-full shadow-lg shadow-red-500/40">
                            <Bell className="w-10 h-10 animate-shake" />
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight uppercase">Support Required!</h2>
                    <p className="text-red-500 font-bold text-sm tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Priority Internal Ping
                    </p>

                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8 space-y-4">
                        <div className="flex items-center gap-4 text-left">
                            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <User className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Requested By</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight">{senderName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-left">
                            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                                <MapPin className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Location</p>
                                <p className="text-sm font-bold text-gray-700 leading-tight">{locationName}</p>
                            </div>
                        </div>
                        
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
                            <span className="text-gray-400 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Received {formatDistanceToNow(parseISO(activePing.createdAt), { addSuffix: true })}
                            </span>
                            <span className="text-amber-600 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100">
                                Auto-Stops in {Math.ceil((ALARM_TIMEOUT_MS - (new Date().getTime() - new Date(activePing.createdAt).getTime())) / 1000)}s
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <Button 
                            className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 border-none text-white text-lg font-black uppercase tracking-widest shadow-xl shadow-emerald-700/30 group transition-all"
                            onClick={() => acknowledgeNotification(activePing.id)}
                        >
                            <CheckCircle className="w-6 h-6 mr-3 group-hover:scale-125 transition-transform" /> 
                            Acknowledge Request
                        </Button>
                        <p className="text-[10px] text-gray-400 font-medium">Acknowledging will stop the alarm for all nearby support staff.</p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(15deg); }
                    75% { transform: rotate(-15deg); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out infinite;
                }
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};
