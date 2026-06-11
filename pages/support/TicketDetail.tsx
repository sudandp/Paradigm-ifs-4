import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { SupportTicket, TicketPost, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { 
    Clock, Tag, MessageSquare, Paperclip, Send, CheckCircle2, AlertCircle, Clock3, 
    Search, Filter, Loader2, ArrowLeft, MoreVertical, XCircle, Users, Phone, Video, Star, AlertTriangle, MessageCircle,
    ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { format } from 'date-fns';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import TicketPostComponent from '../../components/support/TicketPost';
import CloseTicketModal from '../../components/support/CloseTicketModal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { getProxyUrl } from '../../utils/fileUrl';


const PriorityIndicator: React.FC<{ priority: SupportTicket['priority'] }> = ({ priority }) => {
    const styles = {
        Low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        Urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[priority]}`}>{priority}</span>;
};

const StatusChip: React.FC<{ status: SupportTicket['status'] }> = ({ status }) => {
    const styles = {
        Open: 'status-chip--pending',
        'In Progress': 'sync-chip--pending_sync',
        'Pending Requester': 'leave-status-chip--pending_hr_confirmation',
        Resolved: 'leave-status-chip--approved',
        Closed: 'status-chip--draft',
    };
    return <span className={`status-chip ${styles[status]}`}>{status}</span>;
};


const TicketDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isMobileDetailsExpanded, setIsMobileDetailsExpanded] = useState(false);
    const isMobile = useMediaQuery('(max-width: 1023px)');
    const userIsAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer';

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [ticketData, usersData] = await Promise.all([
                    api.getSupportTicketById(id),
                    api.getNearbyUsers(user?.id)
                ]);
                if (ticketData) {
                    setTicket(ticketData);
                } else {
                    setToast({ message: 'Ticket not found.', type: 'error' });
                    navigate('/support');
                }
                // Show only online users near the logged-in user's location
                setNearbyUsers(usersData.nearbyOnline);
            } catch (error) {
                setToast({ message: 'Failed to load ticket data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);
    
    const handleAddPost = async () => {
        if (!newPostContent.trim() || !ticket || !user) return;
        setIsPosting(true);
        try {
            const newPost = await api.addTicketPost(ticket.id, {
                ticketId: ticket.id,
                authorId: user.id,
                authorName: user.name,
                authorRole: user.role,
                content: newPostContent
            });
            setTicket(prev => prev ? { ...prev, posts: [...prev.posts, newPost] } : null);
            setNewPostContent('');
        } catch (e) {
            setToast({ message: 'Failed to add post.', type: 'error' });
        } finally {
            setIsPosting(false);
        }
    };

    const handleTicketUpdate = async (updates: Partial<SupportTicket>) => {
        if (!ticket) return;
        try {
            const updatedTicket = await api.updateSupportTicket(ticket.id, updates);
            setTicket(updatedTicket);
            if(updates.status) setToast({ message: `Ticket status updated to ${updates.status}`, type: 'success' });
        } catch (e) {
            setToast({ message: 'Failed to update ticket.', type: 'error' });
        }
    };
    
    const handleCloseTicket = async (rating: number, feedback: string) => {
        await handleTicketUpdate({ status: 'Closed', rating, feedback, closedAt: new Date().toISOString() });
        setIsCloseModalOpen(false);
    };

    const handleDeleteTicket = async () => {
        if (!window.confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) return;
        try {
            await api.deleteSupportTicket(ticket.id);
            setToast({ message: 'Ticket deleted successfully.', type: 'success' });
            setTimeout(() => {
                navigate('/support');
            }, 1500);
        } catch (err) {
            setToast({ message: 'Failed to delete ticket.', type: 'error' });
        }
    };
    
    const handleCommunication = async (targetUser: User, type: 'call' | 'sms' | 'whatsapp') => {
        if (!targetUser.phone) {
            setToast({ message: 'User does not have a phone number.', type: 'error' });
            return;
        }

        let numberToCall = targetUser.phone.replace(/\D/g, '');
        if (numberToCall.length > 10) numberToCall = numberToCall.slice(-10);
        
        if (numberToCall.length !== 10) {
            setToast({ message: 'Invalid phone number format.', type: 'error' });
            return;
        }

        // Log the communication
        if (user) {
            try {
                await api.logCommunication({
                    senderId: user.id,
                    receiverId: targetUser.id,
                    type,
                    metadata: {
                        targetPhone: numberToCall,
                        ticketId: ticket.id,
                        ticketNumber: ticket.ticketNumber,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (err) {
                console.error('Failed to log communication:', err);
                // Continue with the action even if logging fails
            }
        }

        if (type === 'whatsapp') {
            window.open(`https://wa.me/91${numberToCall}`, '_blank');
        } else if (type === 'call') {
            window.location.href = `tel:+91${numberToCall}`;
        } else if (type === 'sms') {
            window.location.href = `sms:+91${numberToCall}`;
        }
    };

    const handlePing = async (targetUser: User) => {
        if (!user) return;
        try {
            await api.createNotification({
                userId: targetUser.id,
                type: 'direct_ping',
                title: 'Nearby Support Request',
                message: `${user.name} is requesting support nearby for Ticket #${ticket.ticketNumber}.`,
                metadata: {
                    senderId: user.id,
                    senderName: user.name,
                    ticketId: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    locationName: user.locationName || 'Nearby Location'
                }
            });
            setToast({ message: `Sent a ping to ${targetUser.name}!`, type: 'success' });
        } catch (error) {
            console.error('Failed to send ping:', error);
            setToast({ message: 'Failed to send ping.', type: 'error' });
        }
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-accent"/></div>;
    if (!ticket) return null;

    const isRequester = user?.id === ticket.raisedById;

    const renderActionButtons = () => {
        if (ticket.status === 'Closed') return null;

        return (
            <div className="flex flex-wrap gap-2">
                {ticket.status === 'Open' && (
                    <Button onClick={() => handleTicketUpdate({ status: 'In Progress', assignedToId: user?.id, assignedToName: user?.name })}>
                        Assign to Me
                    </Button>
                )}
                 {ticket.status === 'In Progress' && user?.id === ticket.assignedToId && (
                    <Button onClick={() => handleTicketUpdate({ status: 'Resolved', resolvedAt: new Date().toISOString() })}>
                        Mark as Resolved
                    </Button>
                )}
                 {ticket.status === 'Resolved' && isRequester && (
                    <Button onClick={() => setIsCloseModalOpen(true)}>
                        Close Ticket
                    </Button>
                )}
            </div>
        );
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4">
             {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
             {isCloseModalOpen && <CloseTicketModal isOpen={isCloseModalOpen} onClose={() => setIsCloseModalOpen(false)} onSubmit={handleCloseTicket} />}

             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <Button variant="icon" onClick={() => navigate('/support')}><ArrowLeft/></Button>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-primary-text">{ticket.title}</h2>
                        <p className="text-xs text-muted">#{ticket.ticketNumber}</p>
                    </div>
                 </div>
                 {userIsAdmin && (
                     <Button 
                         variant="icon" 
                         className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-xl transition-all"
                         title="Delete Ticket"
                         onClick={handleDeleteTicket}
                     >
                         <Trash2 className="w-5 h-5" />
                     </Button>
                 )}
             </div>

             <div className="lg:grid lg:grid-cols-3 lg:gap-6">
                <main className="lg:col-span-2 space-y-6">
                    {isMobile ? (
                        <div className="space-y-4">
                            {/* Mobile Toggle Button */}
                            <button
                                onClick={() => setIsMobileDetailsExpanded(!isMobileDetailsExpanded)}
                                className="w-full bg-[#0d2c18] border border-[#123820] rounded-2xl p-4 flex items-center justify-between text-left transition-all active:scale-[0.99] shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Ticket Info & Progress</p>
                                        <p className="text-[11px] text-emerald-400/80 font-medium flex items-center gap-2 mt-0.5">
                                            <span>{ticket.status}</span>
                                            <span className="w-1 h-1 rounded-full bg-emerald-500/40"></span>
                                            <span>{ticket.priority}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                                        {isMobileDetailsExpanded ? 'Hide' : 'View'}
                                    </span>
                                    {isMobileDetailsExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-emerald-500" />
                                    )}
                                </div>
                            </button>

                            {/* Collapsible details content */}
                            {isMobileDetailsExpanded && (
                                <div className="bg-[#0d2c18] p-5 rounded-2xl border border-[#123820] space-y-4 animate-fade-in text-white">
                                    <div className="flex flex-wrap gap-4 justify-between items-start">
                                         <div className="flex items-center gap-4">
                                            <StatusChip status={ticket.status} />
                                            <PriorityIndicator priority={ticket.priority} />
                                        </div>
                                        <div className="text-sm text-gray-300 text-right">
                                            <p>Raised by: <span className="font-semibold text-white">{ticket.raisedByName}</span></p>
                                            <p>{format(new Date(ticket.raisedAt), 'dd MMM, yyyy - hh:mm a')}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{ticket.description}</p>
                                    {ticket.attachmentUrl && (ticket.attachmentUrl.startsWith('http') || ticket.attachmentUrl.startsWith('https') || ticket.attachmentUrl.startsWith('data:')) && (
                                        <div className="mt-4">
                                            <h5 className="text-sm font-semibold text-white mb-2">Attachment</h5>
                                            <button 
                                                onClick={() => {
                                                    const proxyUrl = getProxyUrl(ticket.attachmentUrl!);
                                                    navigate(`/document-viewer?url=${encodeURIComponent(proxyUrl)}&title=${encodeURIComponent(`Attachment-${ticket.ticketNumber}`)}`);
                                                }} 
                                                className="block border border-[#1d422f] rounded-lg overflow-hidden max-w-xs hover:border-accent text-left"
                                            >
                                                <img 
                                                    src={ticket.attachmentUrl} 
                                                    alt="Attachment" 
                                                    className="max-h-64 w-auto" 
                                                    onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                                                />
                                            </button>
                                        </div>
                                    )}
                                    <div className="pt-5 border-t border-[#1d422f]/40 space-y-5">
                                        {/* Category Info Pill */}
                                        <div className="flex items-center justify-between bg-[#0a1c13] border border-[#1d422f]/60 rounded-xl p-3 shadow-inner">
                                            <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-emerald-500/80">Category</span>
                                            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-bold tracking-wide">
                                                {ticket.category}
                                            </span>
                                        </div>
                                        
                                        {/* Vertical Timeline and Allocation Card */}
                                        <div className="bg-[#0a1c13]/60 border border-[#1d422f]/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                                            
                                            <h4 className="font-black text-emerald-500 uppercase tracking-[0.15em] text-[10px] mb-6 flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" /> Timeline & Allocation
                                            </h4>
                                            
                                            <div className="relative pl-5 border-l-2 border-[#1d422f]/80 ml-2 space-y-6">
                                                {/* Raised Event */}
                                                <div className="relative">
                                                    <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[#006B3F] border-2 border-[#041b0f] shadow-[0_0_8px_rgba(0,107,63,0.8)] flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full"></div>
                                                    </div>
                                                    <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-black">Ticket Raised</p>
                                                    <p className="text-white font-bold text-sm mt-0.5">By {ticket.raisedByName}</p>
                                                    <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-1 font-mono">
                                                        <Clock3 className="w-3 h-3 text-[#006B3F]" />
                                                        {format(new Date(ticket.raisedAt), 'dd MMM, yyyy • hh:mm a')}
                                                    </p>
                                                </div>

                                                {/* Assigned Event */}
                                                <div className="relative">
                                                    <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#041b0f] flex items-center justify-center ${ticket.assignedToId ? 'bg-[#006B3F] shadow-[0_0_8px_rgba(0,107,63,0.8)]' : 'bg-gray-800'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${ticket.assignedToId ? 'bg-emerald-300' : 'bg-gray-600'}`}></div>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Allocation Status</p>
                                                    <p className="text-white font-bold text-sm mt-0.5">
                                                        {ticket.assignedToName ? `Allocated to ${ticket.assignedToName}` : 'Unassigned / Pending Allocation'}
                                                    </p>
                                                </div>

                                                {/* Resolved Event */}
                                                {ticket.resolvedAt && (
                                                    <div className="relative">
                                                        <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[#006B3F] border-2 border-[#041b0f] shadow-[0_0_8px_rgba(0,107,63,0.8)] flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full"></div>
                                                        </div>
                                                        <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-black">Resolved</p>
                                                        <p className="text-white font-bold text-sm mt-0.5">Issue Fixed</p>
                                                        <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-1 font-mono">
                                                            <Clock3 className="w-3 h-3 text-[#006B3F]" />
                                                            {format(new Date(ticket.resolvedAt), 'dd MMM, yyyy • hh:mm a')}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Closed Event */}
                                                {ticket.closedAt && (
                                                    <div className="relative">
                                                        <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-gray-700 border-2 border-[#041b0f] flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Closed</p>
                                                        <p className="text-white font-bold text-sm mt-0.5">Ticket Archived</p>
                                                        <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-1 font-mono">
                                                            <Clock3 className="w-3 h-3 text-gray-500" />
                                                            {format(new Date(ticket.closedAt), 'dd MMM, yyyy • hh:mm a')}
                                                        </p>
                                                        {ticket.rating && (
                                                            <div className="flex items-center gap-1.5 mt-2.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-xl w-fit text-yellow-400 shadow-sm animate-pulse">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-500">Feedback Rating:</span>
                                                                <span className="font-black text-sm leading-none">{ticket.rating}</span>
                                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-[#1d422f]/40">
                                        {renderActionButtons()}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-card p-4 rounded-xl shadow-card space-y-4">
                            <div className="flex flex-wrap gap-4 justify-between items-start">
                                 <div className="flex items-center gap-4">
                                    <StatusChip status={ticket.status} />
                                    <PriorityIndicator priority={ticket.priority} />
                                </div>
                                <div className="text-sm text-muted text-right">
                                    <p>Raised by: <span className="font-semibold text-primary-text">{ticket.raisedByName}</span></p>
                                    <p>{format(new Date(ticket.raisedAt), 'dd MMM, yyyy - hh:mm a')}</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted whitespace-pre-wrap">{ticket.description}</p>
                            {ticket.attachmentUrl && (ticket.attachmentUrl.startsWith('http') || ticket.attachmentUrl.startsWith('https') || ticket.attachmentUrl.startsWith('data:')) && (
                                <div className="mt-4">
                                    <h5 className="text-sm font-semibold text-primary-text mb-2">Attachment</h5>
                                    <button 
                                        onClick={() => {
                                            const proxyUrl = getProxyUrl(ticket.attachmentUrl!);
                                            navigate(`/document-viewer?url=${encodeURIComponent(proxyUrl)}&title=${encodeURIComponent(`Attachment-${ticket.ticketNumber}`)}`);
                                        }} 
                                        className="block border rounded-lg overflow-hidden max-w-xs hover:border-accent text-left"
                                    >
                                        <img 
                                            src={ticket.attachmentUrl} 
                                            alt="Attachment" 
                                            className="max-h-64 w-auto" 
                                            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-4">
                        {ticket.posts.map(post => (
                            <TicketPostComponent key={post.id} post={post} ticket={ticket} setTicket={setTicket} />
                        ))}
                    </div>

                    {ticket.status !== 'Closed' && (
                        <div className="bg-card p-4 rounded-xl shadow-card flex items-start gap-3">
                            <ProfilePlaceholder className="w-10 h-10 rounded-full flex-shrink-0" />
                            <div className="w-full">
                                <textarea
                                    value={newPostContent}
                                    onChange={e => setNewPostContent(e.target.value)}
                                    placeholder="Add a public reply..."
                                    className="form-input w-full"
                                    rows={3}
                                />
                                <div className="mt-2 flex justify-between items-center">
                                    <Button variant="icon" size="sm" title="Attach file"><Paperclip className="h-5 w-5"/></Button>
                                    <Button onClick={handleAddPost} isLoading={isPosting}>
                                        <Send className="mr-2 h-4"/> Post
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {!isMobile && (
                    <aside className="space-y-6 mt-6 lg:mt-0">
                        <div className="bg-card p-4 rounded-xl shadow-card">
                            <h3 className="font-semibold text-primary-text mb-3">Ticket Details</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted">Assigned To:</span> <span className="font-semibold">{ticket.assignedToName || 'Unassigned'}</span></div>
                                <div className="flex justify-between"><span className="text-muted">Category:</span> <span>{ticket.category}</span></div>
                                {ticket.resolvedAt && <div className="flex justify-between"><span className="text-muted">Resolved:</span> <span>{format(new Date(ticket.resolvedAt), 'dd MMM, yy')}</span></div>}
                                {ticket.closedAt && <div className="flex justify-between"><span className="text-muted">Closed:</span> <span>{format(new Date(ticket.closedAt), 'dd MMM, yy')}</span></div>}
                                {ticket.rating && <div className="flex justify-between"><span className="text-muted">Rating:</span> <span className="flex items-center gap-1">{ticket.rating} <Star className="h-4 w-4 text-yellow-400 fill-current"/></span></div>}
                            </div>
                            <div className="mt-4 pt-4 border-t border-border">
                               {renderActionButtons()}
                            </div>
                        </div>
                         <div className="bg-card p-4 rounded-xl shadow-card">
                            <h3 className="font-semibold text-primary-text mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-muted"/> Nearby Users</h3>
                            <div className="space-y-3">
                                {nearbyUsers.map(u => (
                                    <div key={u.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${u.isNearby ? 'bg-accent/5 ring-1 ring-accent/20' : ''}`}>
                                        <div className="relative flex-shrink-0">
                                            <ProfilePlaceholder photoUrl={u.photoUrl} seed={u.id} className="w-10 h-10 rounded-full" />
                                            <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ${u.isAvailable ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-gray-400'} ring-2 ring-card`}></span>
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <p className="text-sm font-semibold truncate">{u.name}</p>
                                                {u.isNearby && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent" title="Nearby"></span>}
                                            </div>
                                            <p className="text-[10px] text-muted truncate">
                                                {u.locationName && <span className="text-accent/70">{u.locationName} • </span>}
                                                {u.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                variant="icon" 
                                                size="sm" 
                                                className="hover:opacity-90 transition-opacity border"
                                                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                                                title="Ping (Internal)" 
                                                onClick={() => handlePing(u)}
                                            >
                                                <AlertTriangle className="h-3.5 w-3.5"/>
                                            </Button>
                                            <Button 
                                                variant="icon" 
                                                size="sm" 
                                                className="hover:opacity-90 transition-opacity border"
                                                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                                                title="Call" 
                                                onClick={() => handleCommunication(u, 'call')}
                                            >
                                                <Phone className="h-3.5 w-3.5"/>
                                            </Button>
                                            <Button 
                                                variant="icon" 
                                                size="sm" 
                                                className="hover:opacity-90 transition-opacity border"
                                                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                                                title="SMS" 
                                                onClick={() => handleCommunication(u, 'sms')}
                                            >
                                                <MessageCircle className="h-3.5 w-3.5"/>
                                            </Button>
                                            <Button 
                                                variant="icon" 
                                                size="sm" 
                                                className="hover:opacity-90 transition-opacity border"
                                                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                                                title="WhatsApp" 
                                                onClick={() => handleCommunication(u, 'whatsapp')}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5"/>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {nearbyUsers.length === 0 && (
                                    <p className="text-center py-4 text-xs text-muted">No staff found nearby.</p>
                                )}
                            </div>
                        </div>
                    </aside>
                )}
             </div>
        </div>
    );
};

export default TicketDetail;