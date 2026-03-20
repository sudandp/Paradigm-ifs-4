/**
 * Device Management Service
 * 
 * Handles all device-related operations including:
 * - Device registration and verification
 * - Device validation and approval workflow
 * - Device activity logging
 * - Device limit enforcement
 */

import { supabase } from './supabase';
import {
  UserDevice,
  DeviceChangeRequest,
  DeviceActivityLog,
  DeviceType,
  DeviceStatus,
  DeviceRequestStatus,
  DeviceActivityType,
  DeviceInfo,
  DeviceLimitsConfig,
} from '../types';
import {
  generateDeviceIdentifier,
  getDeviceInfo,
  generateDeviceName,
  detectDeviceType,
} from '../utils/deviceFingerprint';
import { api } from './api';

/**
 * Get device limits for a specific staff category
 */
export async function getDeviceLimits(roleId: string): Promise<DeviceLimitsConfig> {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('attendance_settings')
      .eq('id', 'singleton')
      .single();
    
    if (error) throw error;
    
    
    const attendanceSettings = api.toCamelCase(settings?.attendance_settings || {});
    
    // Map role to staff category
    const normalizedRole = (roleId || '').toLowerCase();
    
    // Check for Admin
    if (normalizedRole === 'admin' || normalizedRole === 'developer') {
      const adminRules = attendanceSettings.admin;
      if (adminRules && adminRules.deviceLimits) {
        return adminRules.deviceLimits;
      }
      // Fallback for admin if not configured yet
      return { web: 5, android: 5, ios: 5 };
    }

    // Check for Management
    if (['management', 'hr_ops', 'finance_manager', 'gm', 'ceo', 'director'].includes(normalizedRole)) {
      const managementRules = attendanceSettings.management;
      if (managementRules && managementRules.deviceLimits) {
        return managementRules.deviceLimits;
      }
      // Fallback for management if not configured yet
      return { web: 5, android: 5, ios: 5 };
    }
    
    // Check for Field Staff
    if (['field_staff', 'field_manager', 'field_executive'].includes(normalizedRole)) {
       const fieldRules = attendanceSettings.field;
       if (fieldRules && fieldRules.deviceLimits) {
         return fieldRules.deviceLimits;
       }
    }

    // Check for Site Staff
    if (['site_staff', 'site_manager', 'security_guard'].includes(normalizedRole)) {
       const siteRules = attendanceSettings.site;
       if (siteRules && siteRules.deviceLimits) {
         return siteRules.deviceLimits;
       }
    }
    
    // Check for Office Staff
    const officeRules = attendanceSettings.office;
    if (officeRules && officeRules.deviceLimits) {
      return officeRules.deviceLimits;
    }

    // Default for everyone else if nothing configured
    return { web: 1, android: 1, ios: 1 };
  } catch (error) {
    console.error('Error getting device limits:', error);
    return { web: 1, android: 1, ios: 1 };
  }
}

/**
 * Get current device info and identifier
 */
export async function getCurrentDevice() {
  const deviceIdentifier = await generateDeviceIdentifier();
  const deviceInfo = await getDeviceInfo();
  const deviceType = await detectDeviceType();
  const deviceName = await generateDeviceName();
  
  return {
    deviceIdentifier,
    deviceInfo,
    deviceType,
    deviceName,
  };
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(userId: string): Promise<UserDevice[]> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select(`
        *,
        approver:approved_by_id(name)
      `)
      .eq('user_id', userId)
      .order('registered_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(device => ({
      ...device,
      userId: device.user_id,
      deviceType: device.device_type,
      deviceIdentifier: device.device_identifier,
      deviceName: device.device_name,
      deviceInfo: device.device_info || {},
      registeredAt: device.registered_at,
      lastUsedAt: device.last_used_at,
      approvedById: device.approved_by_id,
      approvedByName: device.approver?.name,
      approvedAt: device.approved_at,
      createdAt: device.created_at,
      updatedAt: device.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching user devices:', error);
    throw error;
  }
}

/**
 * Get count of active devices by type for a user
 */
export async function getActiveDeviceCount(
  userId: string,
  deviceType: DeviceType
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('user_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('device_type', deviceType)
      .eq('status', 'active');
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('Error counting devices:', error);
    return 0;
  }
}

/**
 * Check if a device is registered and active
 */
export async function isDeviceAuthorized(
  userId: string,
  deviceIdentifier: string
): Promise<{
  authorized: boolean;
  device?: UserDevice;
  status: 'active' | 'pending' | 'revoked' | 'not_found';
}> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .ilike('device_identifier', deviceIdentifier)
      .order('last_used_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    const singleData = data && data.length > 0 ? data[0] : null;
    
    if (!singleData) {
      return { authorized: false, status: 'not_found' };
    }
    
    const device: UserDevice = {
      ...singleData,
      userId: singleData.user_id,
      deviceType: singleData.device_type,
      deviceIdentifier: singleData.device_identifier,
      deviceName: singleData.device_name,
      deviceInfo: singleData.device_info || {},
      registeredAt: singleData.registered_at,
      lastUsedAt: singleData.last_used_at,
      approvedById: singleData.approved_by_id,
      approvedAt: singleData.approved_at,
      createdAt: singleData.created_at,
      updatedAt: singleData.updated_at,
    };
    
    return {
      authorized: device.status === 'active',
      device,
      status: device.status,
    };
  } catch (error) {
    console.error('Error checking device authorization:', error);
    return { authorized: false, status: 'not_found' };
  }
}

/**
 * Register a new device (auto-approve if within limits, otherwise create request)
 */
export async function registerDevice(
  userId: string,
  roleId: string,
  deviceIdentifier: string,
  deviceType: DeviceType,
  deviceName: string,
  deviceInfo: DeviceInfo
): Promise<{
  success: boolean;
  device?: UserDevice;
  request?: DeviceChangeRequest;
  requiresApproval: boolean;
  message: string;
}> {
  try {
    const normalizedId = deviceIdentifier.toLowerCase();
    
    // Check if device already exists
    const existingCheck = await isDeviceAuthorized(userId, normalizedId);
    if (existingCheck.device) {
      if (existingCheck.status === 'active') {
        // If it's an existing device, check if it was used recently 
        // to determine if we should notify about a "switch"
        const lastUsed = existingCheck.device.lastUsedAt ? new Date(existingCheck.device.lastUsedAt).getTime() : 0;
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;

        // If not used in the last hour on THIS device, consider it a switch/re-login notification
        if (now - lastUsed > oneHour) {
          try {
            await api.sendDeviceChangeAlert(userId, '', 'Previous Session', deviceName);
          } catch (notifyErr) {
            console.warn('Failed to send device switch alert:', notifyErr);
          }
        }

        // Update last used time and sync newest info (battery, ip, etc.)
        await supabase
          .from('user_devices')
          .update({ 
            last_used_at: new Date().toISOString(),
            device_info: deviceInfo // Update with latest stats (battery, etc.)
          })
          .eq('id', existingCheck.device.id);
        return {
          success: true,
          device: existingCheck.device,
          requiresApproval: false,
          message: 'Device already registered and active',
        };
      } else if (existingCheck.status === 'pending') {
        return {
          success: false,
          requiresApproval: true,
          message: 'Device registration is pending approval',
        };
      } else if (existingCheck.status === 'revoked') {
        // Revoked devices require manual re-activation request
        return {
          success: false,
          requiresApproval: true,
          message: 'This device was previously revoked. Please contact admin or request re-activation.',
        };
      }
    }

    // NO FALLBACK MERGE: Removed broad "similar device" detection as it caused
    // different physical units to overwrite each other. 
    // From now on, devices are separated strictly by their device_identifier (capacitor UUID).
    
    // Get device limits
    const limits = await getDeviceLimits(roleId);
    const currentCount = await getActiveDeviceCount(userId, deviceType);
    const limit = limits[deviceType];
    
    // Check if within limits
    if (currentCount < limit) {
      // Auto-approve (first device)
      const { data, error } = await supabase
        .from('user_devices')
        .insert({
          user_id: userId,
          device_type: deviceType,
          device_identifier: normalizedId,
          device_name: deviceName,
          device_info: deviceInfo,
          status: 'active',
          approved_by_id: userId, // Self-approved within limits
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await logDeviceActivity(userId, data.id, 'registration', deviceInfo);
      
      // Notify reporting manager about the new device
      try {
        await api.sendDeviceChangeAlert(userId, '', 'None (New)', deviceName);
      } catch (notifyErr) {
        console.warn('Failed to send device change alert:', notifyErr);
      }
      
      return {
        success: true,
        device: {
          ...data,
          userId: data.user_id,
          deviceType: data.device_type,
          deviceIdentifier: data.device_identifier,
          deviceName: data.device_name,
          deviceInfo: data.device_info || {},
          registeredAt: data.registered_at,
          lastUsedAt: data.last_used_at,
          approvedById: data.approved_by_id,
          approvedAt: data.approved_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
        requiresApproval: false,
        message: 'Device registered successfully',
      };
    } else {
      // Exceeds limit - don't auto-create request, let the user "press" to request
      return {
        success: false,
        requiresApproval: true,
        message: `Device limit of ${limit} reached for your role. Please request access to use this device.`,
      };
    }
  } catch (error) {
    console.error('Error registering device:', error);
    throw error;
  }
}

/**
 * Create a device change request
 */
export async function createDeviceChangeRequest(
  userId: string,
  deviceType: DeviceType,
  deviceIdentifier: string,
  deviceName: string,
  deviceInfo: DeviceInfo
): Promise<DeviceChangeRequest> {
  try {
    // Check if a pending request already exists for this device
    const { data: existingRequest } = await supabase
      .from('device_change_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('device_identifier', deviceIdentifier)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return {
        ...existingRequest,
        userId: existingRequest.user_id,
        deviceType: existingRequest.device_type,
        deviceIdentifier: existingRequest.device_identifier,
        deviceName: existingRequest.device_name,
        deviceInfo: existingRequest.device_info || {},
        requestedAt: existingRequest.requested_at,
        reviewedById: existingRequest.reviewed_by_id,
        reviewedAt: existingRequest.reviewed_at,
        rejectionReason: existingRequest.rejection_reason,
        reportingManagerNotified: existingRequest.reporting_manager_notified,
        createdAt: existingRequest.created_at,
        updatedAt: existingRequest.updated_at,
      };
    }

    const { data, error } = await supabase
      .from('device_change_requests')
      .insert({
        user_id: userId,
        device_type: deviceType,
        device_identifier: deviceIdentifier,
        device_name: deviceName,
        device_info: deviceInfo,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Send notifications (will be implemented in notification service)
    await notifyDeviceChangeRequest(data.id, userId);
    
    return {
      ...data,
      userId: data.user_id,
      deviceType: data.device_type,
      deviceIdentifier: data.device_identifier,
      deviceName: data.device_name,
      deviceInfo: data.device_info || {},
      requestedAt: data.requested_at,
      reviewedById: data.reviewed_by_id,
      reviewedAt: data.reviewed_at,
      rejectionReason: data.rejection_reason,
      reportingManagerNotified: data.reporting_manager_notified,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating device change request:', error);
    throw error;
  }
}

/**
 * Get all pending device change requests (for admins/HR)
 */
export async function getPendingDeviceRequests(): Promise<DeviceChangeRequest[]> {
  try {
    const { data, error } = await supabase
      .from('device_change_requests')
      .select(`
        *,
        user:user_id(name, photo_url, role_id, reporting_manager_id),
        reviewer:reviewed_by_id(name)
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    
    if (error) throw error;
    
    // Get reporting manager names
    const requests = await Promise.all(
      (data || []).map(async (req) => {
        let reportingManagerName;
        if (req.user?.reporting_manager_id) {
          const { data: manager } = await supabase
            .from('users')
            .select('name')
            .eq('id', req.user.reporting_manager_id)
            .single();
          reportingManagerName = manager?.name;
        }
        
        // Get current device count
        const currentDeviceCount = await getActiveDeviceCount(
          req.user_id,
          req.device_type
        );
        
        return {
          ...req,
          userId: req.user_id,
          userName: req.user?.name,
          userPhotoUrl: req.user?.photo_url,
          reportingManagerName,
          deviceType: req.device_type,
          deviceIdentifier: req.device_identifier,
          deviceName: req.device_name,
          deviceInfo: req.device_info || {},
          requestedAt: req.requested_at,
          reviewedById: req.reviewed_by_id,
          reviewedByName: req.reviewer?.name,
          reviewedAt: req.reviewed_at,
          rejectionReason: req.rejection_reason,
          reportingManagerNotified: req.reporting_manager_notified,
          createdAt: req.created_at,
          updatedAt: req.updated_at,
          currentDeviceCount,
        };
      })
    );
    
    return requests;
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
}

/**
 * Approve a device change request
 */
export async function approveDeviceRequest(
  requestId: string,
  approvedById: string
): Promise<{ success: boolean; device?: UserDevice }> {
  try {
    // Get the request details
    const { data: request, error: fetchError } = await supabase
      .from('device_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!request) throw new Error('Request not found');
    
    // Check if device already exists (e.g. revoked or pending)
    const { data: existingDevice } = await supabase
      .from('user_devices')
      .select('id')
      .eq('user_id', request.user_id)
      .eq('device_identifier', request.device_identifier)
      .single();

    let deviceData;
    
    if (existingDevice) {
      // Update existing device
      const { data, error } = await supabase
        .from('user_devices')
        .update({
          status: 'active',
          device_name: request.device_name,
          device_info: request.device_info,
          approved_by_id: approvedById,
          approved_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        })
        .eq('id', existingDevice.id)
        .select()
        .single();
        
      if (error) throw error;
      deviceData = data;
    } else {
      // Create new device record
      const { data, error } = await supabase
        .from('user_devices')
        .insert({
          user_id: request.user_id,
          device_type: request.device_type,
          device_identifier: request.device_identifier,
          device_name: request.device_name,
          device_info: request.device_info,
          status: 'active',
          approved_by_id: approvedById,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();
        
      if (error) throw error;
      deviceData = data;
    }
    
    // Update the request status
    const { error: updateError } = await supabase
      .from('device_change_requests')
      .update({
        status: 'approved',
        reviewed_by_id: approvedById,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    
    if (updateError) throw updateError;
    
    // Send notification to user
    await notifyDeviceApproved(request.user_id, request.device_name, approvedById);
    
    return {
      success: true,
      device: {
        ...deviceData,
        userId: deviceData.user_id,
        deviceType: deviceData.device_type,
        deviceIdentifier: deviceData.device_identifier,
        deviceName: deviceData.device_name,
        deviceInfo: deviceData.device_info || {},
        registeredAt: deviceData.registered_at,
        lastUsedAt: deviceData.last_used_at,
        approvedById: deviceData.approved_by_id,
        approvedAt: deviceData.approved_at,
        createdAt: deviceData.created_at,
        updatedAt: deviceData.updated_at,
      },
    };
  } catch (error) {
    console.error('Error approving device:', error);
    throw error;
  }
}

/**
 * Reject a device change request
 */
export async function rejectDeviceRequest(
  requestId: string,
  reviewedById: string,
  rejectionReason: string
): Promise<{ success: boolean }> {
  try {
    // Get the request details for notification
    const { data: request, error: fetchError } = await supabase
      .from('device_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const { error } = await supabase
      .from('device_change_requests')
      .update({
        status: 'rejected',
        reviewed_by_id: reviewedById,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId);
    
    if (error) throw error;
    
    // Send notification to user
    if (request) {
      await notifyDeviceRejected(request.user_id, request.device_name, rejectionReason);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error rejecting device:', error);
    throw error;
  }
}

/**
 * Revoke a device
 */
export async function revokeDevice(deviceId: string): Promise<{ success: boolean }> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({ status: 'revoked' })
      .eq('id', deviceId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error revoking device:', error);
    throw error;
  }
}

/**
 * Permanently delete a device
 */
export async function deleteDevice(deviceId: string): Promise<{ success: boolean }> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', deviceId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting device:', error);
    throw error;
  }
}

/**
 * Update device last used timestamp
 */
export async function updateDeviceLastUsed(deviceId: string): Promise<void> {
  try {
    await supabase
      .from('user_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', deviceId);
  } catch (error) {
    console.error('Error updating device last used:', error);
  }
}

/**
 * Log device activity
 */
export async function logDeviceActivity(
  userId: string,
  deviceId: string | null,
  activityType: DeviceActivityType,
  deviceInfo?: DeviceInfo,
  ipAddress?: string
): Promise<void> {
  try {
    await supabase
      .from('device_activity_logs')
      .insert({
        user_id: userId,
        device_id: deviceId,
        activity_type: activityType,
        device_info: deviceInfo || {},
        ip_address: ipAddress,
      });
    
    // Update device last used if it's a login
    if (deviceId && activityType === 'login') {
      await updateDeviceLastUsed(deviceId);
    }
  } catch (error) {
    console.error('Error logging device activity:', error);
  }
}

/**
 * Get device activity logs for a user
 */
export async function getDeviceActivityLogs(
  userId: string,
  deviceId?: string
): Promise<DeviceActivityLog[]> {
  try {
    let query = supabase
      .from('device_activity_logs')
      .select(`
        *,
        device:device_id(device_name)
      `)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(log => ({
      ...log,
      userId: log.user_id,
      deviceId: log.device_id,
      deviceName: log.device?.device_name,
      activityType: log.activity_type,
      ipAddress: log.ip_address,
      deviceInfo: log.device_info || {},
      createdAt: log.created_at,
    }));
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
}

// =============================================
// Notification helpers (to be implemented by notification service)
// =============================================

async function notifyDeviceChangeRequest(requestId: string, userId: string): Promise<void> {
  try {
    const { data: user } = await supabase.from('users').select('name, reporting_manager_id').eq('id', userId).single();
    if (!user || !user.reporting_manager_id) return;

    await api.createNotification({
      userId: user.reporting_manager_id,
      title: '📱 Device Access Request',
      message: `${user.name} has exceeded their device limit and requested access for a new device.`,
      type: 'approval_request',
      link: '/user-management',
      metadata: {
        employeeName: user.name,
        requestId
      }
    });
  } catch (error) {
    console.error('Error notifying device change request:', error);
  }
}

async function notifyDeviceApproved(
  userId: string,
  deviceName: string,
  approvedById: string
): Promise<void> {
  try {
    await api.createNotification({
      userId: userId,
      title: '✅ Device Approved',
      message: `Your device "${deviceName}" has been approved for use.`,
      type: 'info',
      metadata: {
        deviceName
      }
    });
  } catch (error) {
    console.error('Error notifying device approved:', error);
  }
}

async function notifyDeviceRejected(
  userId: string,
  deviceName: string,
  reason: string
): Promise<void> {
  try {
    await api.createNotification({
      userId: userId,
      title: '❌ Device Request Rejected',
      message: `Your request for device "${deviceName}" was rejected. Reason: ${reason}`,
      type: 'security',
      metadata: {
        deviceName,
        reason
      }
    });
  } catch (error) {
    console.error('Error notifying device rejected:', error);
  }
}
