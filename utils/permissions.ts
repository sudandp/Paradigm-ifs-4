import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'limited';
export type PermissionType = 
  | 'camera' 
  | 'geolocation' 
  | 'microphone' 
  | 'calendar' 
  | 'contacts' 
  | 'activity';

/**
 * Checks the status of a given permission using Capacitor native APIs.
 * This will work on both Android and iOS.
 * 
 * @param name The name of the permission to check.
 * @returns The current state of the permission.
 */
export const checkPermission = async (name: PermissionType): Promise<PermissionState> => {
  // Only check permissions on native platforms
  if (!Capacitor.isNativePlatform()) {
    return 'granted'; // On web, assume permissions are handled by browser
  }

  try {
    switch (name) {
      case 'camera': {
        const status = await Camera.checkPermissions();
        return status.camera as PermissionState;
      }
      case 'geolocation': {
        const status = await Geolocation.checkPermissions();
        return status.location as PermissionState;
      }
      case 'microphone':
      case 'calendar':
      case 'contacts':
      case 'activity': {
        // For permissions without dedicated Capacitor plugins,
        // we'll assume they need to be requested (return 'prompt')
        // The actual permission dialog will be shown by Android when the feature is used
        return 'prompt';
      }
      default:
        return 'prompt';
    }
  } catch (error) {
    console.error(`Permission check for '${name}' failed`, error);
    return 'prompt';
  }
};

/**
 * Requests a specific permission using Capacitor native APIs.
 * This will show the native Android/iOS permission dialog.
 * 
 * @param name The name of the permission to request.
 * @returns True if permission was granted, false otherwise.
 */
export const requestPermission = async (name: PermissionType): Promise<boolean> => {
  // On web, permissions are handled by the browser
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    switch (name) {
      case 'camera': {
        const status = await Camera.requestPermissions();
        return status.camera === 'granted';
      }
      case 'geolocation': {
        const status = await Geolocation.requestPermissions();
        return status.location === 'granted';
      }
      case 'microphone': {
        // Microphone doesn't have a dedicated Capacitor plugin
        // The permission will be requested when getUserMedia is called
        // We'll use the legacy web API for now
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch {
          return false;
        }
      }
      case 'calendar':
      case 'contacts':
      case 'activity': {
        // These permissions don't have dedicated Capacitor plugins
        // They will be requested automatically when the feature is accessed
        // For now, we return true to indicate they're "available"
        console.info(`Permission '${name}' will be requested when feature is used`);
        return true;
      }
      default:
        return false;
    }
  } catch (error) {
    console.error(`Permission request for '${name}' failed`, error);
    return false;
  }
};

/**
 * A React hook to manage a permission state and provide a function to request it.
 * 
 * @param name The name of the permission to manage.
 * @returns An object with the permission status and a function to request it.
 */
export const usePermission = (name: PermissionType) => {
  const [status, setStatus] = React.useState<PermissionState>('prompt');

  const request = async (): Promise<boolean> => {
    const granted = await requestPermission(name);
    if (granted) {
      setStatus('granted');
    } else {
      setStatus('denied');
    }
    return granted;
  };

  // Check initial status on mount
  React.useEffect(() => {
    checkPermission(name).then(setStatus);
  }, [name]);

  return { status, request };
};

// Import React for the hook
import React from 'react';

/**
 * Utility function to request multiple permissions at once.
 * Useful for features that require several permissions.
 * 
 * @param permissions Array of permission types to request
 * @returns Object mapping permission names to their granted status
 */
export const requestMultiplePermissions = async (
  permissions: PermissionType[]
): Promise<Record<PermissionType, boolean>> => {
  const results: Partial<Record<PermissionType, boolean>> = {};
  
  for (const permission of permissions) {
    results[permission] = await requestPermission(permission);
  }
  
  return results as Record<PermissionType, boolean>;
};

/**
 * Check if all required permissions are granted.
 * 
 * @param permissions Array of permission types to check
 * @returns True if all permissions are granted
 */
export const checkAllPermissions = async (
  permissions: PermissionType[]
): Promise<boolean> => {
  const statuses = await Promise.all(
    permissions.map(p => checkPermission(p))
  );
  
  return statuses.every(status => status === 'granted');
};