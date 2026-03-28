import { supabase } from './supabase';

export interface NotificationActor {
    id: string;
    name: string;
    reportingManagerId?: string;
    role: string;
    photoUrl?: string;
}

export interface NotificationData {
    actorName: string;
    actionText: string;
    locString: string;
    title?: string;
    link?: string;
    actor: NotificationActor;
    severity?: 'Low' | 'Medium' | 'High';
    metadata?: any;
    /** When true, the actor themselves will ALSO receive the notification + push (for self-actions like punch-in, login) */
    selfNotify?: boolean;
    /** Custom message for the actor's own notification (e.g. "Good Morning, Sudhan! You punched in at 9:00 AM") */
    selfMessage?: string;
}

/**
 * Dispatches notifications to recipients based on rules configured in the database.
 * This function identifies active rules for the given event type and role/user,
 * then creates individual notification records for each recipient.
 */
export const dispatchNotificationFromRules = async (eventType: string, data: NotificationData) => {
    try {
        // Fetch rules directly instead of using api.getNotificationRules
        const { data: rulesData, error: rulesError } = await supabase
            .from('notification_rules')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (rulesError) throw rulesError;
        const rules = (rulesData || []).map(r => ({
            id: r.id,
            eventType: r.event_type,
            recipientRole: r.recipient_role,
            recipientUserId: r.recipient_user_id,
            isEnabled: r.is_enabled,
            sendAlert: r.send_alert,
            sendPush: r.send_push
        }));

        const activeRules = rules.filter(r => r.eventType === eventType && r.isEnabled);
        
        // userId -> { shouldSendAlert, shouldSendPush }
        const recipients: Map<string, { sendAlert: boolean, sendPush: boolean }> = new Map();
        
        for (const rule of activeRules) {
            const runner = async (userId: string) => {
                const existing = recipients.get(userId) || { sendAlert: false, sendPush: false };
                recipients.set(userId, {
                    sendAlert: existing.sendAlert || rule.sendAlert || false,
                    sendPush: existing.sendPush || rule.sendPush || false
                });
            };

            if (rule.recipientUserId) {
                if (rule.recipientUserId === 'all') {
                    const { data: allUsers, error } = await supabase.from('users').select('id');
                    if (!error && allUsers) {
                        for (const u of allUsers) await runner(u.id);
                    }
                } else {
                    await runner(rule.recipientUserId);
                }
            } else if (rule.recipientRole) {
                if (rule.recipientRole === 'direct_manager') {
                    if (data.actor.reportingManagerId) {
                        await runner(data.actor.reportingManagerId);
                    }
                } else {
                    const { data: users, error } = await supabase.from('users').select('id').eq('role', rule.recipientRole);
                    if (!error && users) {
                        for (const u of users) await runner(u.id);
                    }
                }
            }
        }

        // Decide whether to keep the actor as a recipient:
        // - selfNotify events (punch-in, login, etc.): actor STAYS to receive their own push
        // - passcode_reset: actor stays because they need to know their code was reset
        // - Everything else: actor is REMOVED to avoid self-notifications for team events
        const selfNotifyEvents = ['passcode_reset', 'user_login', 'user_logout'];
        if (!data.selfNotify && !selfNotifyEvents.includes(eventType)) {
            recipients.delete(data.actor.id);
        }

        if (recipients.size > 0) {
            const message = `${data.actorName} ${data.actionText}${data.locString}`;
            const notifications = Array.from(recipients.entries()).map(([userId, flags]) => ({
                user_id: userId,
                message,
                type: flags.sendAlert ? 'security' : getNotificationTypeForEvent(eventType),
                link_to: data.link,
                severity: data.severity || (flags.sendAlert ? 'High' : (eventType === 'violation' ? 'Medium' : 'Low')),
                metadata: {
                    ...data.metadata,
                    employeeName: data.actor.name,
                    employeePhoto: data.actor.photoUrl,
                    employeeId: data.actor.id,
                    isTeamActivity: ['check_in', 'check_out', 'site_check_in', 'site_check_out', 'break_in', 'break_out', 'break_start', 'break_end', 'not_reported_by_12pm', 'greeting'].includes(eventType),
                    isSelfNotification: (data.selfNotify && userId === data.actor.id) || false
                }
            }));
            
            // Override message for self-notify notifications (the actor gets a personalized message)
            const finalNotifications = notifications.map(n => {
                if (data.selfMessage && n.user_id === data.actor.id) {
                    return { ...n, message: data.selfMessage };
                }
                return n;
            });
            
            await supabase.from('notifications').insert(finalNotifications);

            // Trigger real push notification via FCM Edge Function
            // These event types ALWAYS get push notifications:
            const triggerPushTypes = ['security', 'approval_request', 'task_assigned', 'team_activity', 'emergency_broadcast', ...selfNotifyEvents];
            const pushRecipients = finalNotifications
                .filter((n) => {
                    const flags = recipients.get(n.user_id);
                    // Send push if: rule says sendPush, or notification type is in trigger list,
                    // or this is a self-notify action (user punched in, logged in, etc.)
                    const isSelfAction = data.selfNotify && n.user_id === data.actor.id;
                    return triggerPushTypes.includes(n.type) || (flags?.sendPush === true) || isSelfAction;
                })
                .map(n => n.user_id);

            if (pushRecipients.length > 0) {
                // Trigger real push notification via the new FCM-based Edge Function in bulk
                supabase.functions.invoke('send-notification', {
                    body: {
                        userIds: pushRecipients,
                        title: data.title || 'Paradigm Office',
                        message,
                        data: {
                            link: data.link || '',
                            ...data.metadata
                        }
                    }
                }).catch(err => console.warn('Failed to trigger bulk FCM push:', err));
            }
        }

    } catch (err) {
        console.warn(`Failed to dispatch notifications for ${eventType}:`, err);
    }
};

/**
 * Sends a manual broadcast/announcement to all users via FCM and persists to DB.
 * This is a convenience wrapper for api.broadcastNotification with broadcast=true.
 */
export const sendGlobalAnnouncement = async (title: string, message: string, link?: string) => {
    try {
        const { api } = await import('./api');
        await api.broadcastNotification({
            title,
            message,
            link,
            type: 'info',
            severity: 'Low'
        });
    } catch (err) {
        console.error('Failed to send global announcement:', err);
        throw err;
    }
};


/**
 * Maps a system event type to a UI notification category.
 */
const getNotificationTypeForEvent = (eventType: string): any => {
    if (eventType === 'violation' || eventType.includes('rejected') || eventType.includes('security') || eventType === 'passcode_reset') {
        return 'security';
    }
    if (eventType.includes('task')) {
        return 'task_assigned';
    }
    if (eventType.includes('request')) {
        return 'approval_request';
    }
    if (eventType === 'emergency_broadcast') {
        return 'emergency_broadcast';
    }
    if (eventType === 'greeting' || eventType === 'user_login' || eventType === 'user_logout') {
        return 'greeting';
    }
    if (['check_in', 'check_out', 'site_check_in', 'site_check_out', 'break_in', 'break_out', 'break_start', 'break_end', 'not_reported_by_12pm'].includes(eventType)) {
        return 'team_activity'; // These will be filtered into Team section via metadata
    }
    return 'info';
};

