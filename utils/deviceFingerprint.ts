/**
 * Device Fingerprinting Utility
 * 
 * Generates unique device identifiers for tracking and authentication purposes.
 * - For Web: Creates fingerprint based on browser characteristics
 * - For Mobile (Android/iOS): Uses Capacitor Device API to get unique device ID
 */

import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { DeviceInfo, DeviceType } from '../types';

/**
 * Detect the current platform type
 */
export async function detectDeviceType(): Promise<DeviceType> {
  try {
    const info = await Device.getInfo();
    
    if (info.platform === 'android') {
      return 'android';
    } else if (info.platform === 'ios') {
      return 'ios';
    }
    
    // Fallback check: Some "converted" apps might report 'web' platform 
    // but the User Agent clearly says they are mobile.
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    
    return 'web';
  } catch (error) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    return 'web';
  }
}

/**
 * Get comprehensive device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceType = await detectDeviceType();
  
  if (deviceType === 'web') {
    return await getWebDeviceInfo();
  } else {
    return await getMobileDeviceInfo();
  }
}

/**
 * Get device information for mobile platforms using Capacitor
 */
async function getMobileDeviceInfo(): Promise<DeviceInfo> {
  try {
    const info = await Device.getInfo();
    const id = await Device.getId();
    const battery = await Device.getBatteryInfo();
    const network = await Network.getStatus();
    let appInfo: any = {};
    try {
      appInfo = await App.getInfo();
    } catch (e) {}
    
    const deviceInfo: DeviceInfo = {
      platform: info.platform,
      os: info.operatingSystem,
      osVersion: info.osVersion,
      deviceModel: info.model,
      manufacturer: info.manufacturer,
      uuid: id.identifier,
      androidId: info.platform === 'android' ? id.identifier : undefined,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      batteryLevel: battery.batteryLevel,
      isCharging: battery.isCharging,
      connectionType: network.connectionType,
      appVersion: appInfo.version || '1.0.0',
      hardwareModel: info.model, 
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      canvas: getCanvasFingerprint(),
      webgl: getWebGLFingerprint(),
    };
    
    // Check if what we got from Capacitor is generic/placeholder (common in mobile browsers)
    const normalizedModel = (deviceInfo.deviceModel || '').toUpperCase();
    const normalizedManuf = (deviceInfo.manufacturer || '').toLowerCase();
    
    const isGeneric = 
      !deviceInfo.deviceModel || 
      normalizedModel === 'K' || 
      normalizedModel === 'UNKNOWN' || 
      normalizedModel.includes('ANDROID') || // e.g. "Android SDK built for x86"
      normalizedManuf.includes('google inc') ||
      normalizedManuf === 'unknown';

    // Fallback model from UA if native model is generic/empty
    if (isGeneric) {
      const uaModel = parseAndroidModel(navigator.userAgent);
      if (uaModel) {
        deviceInfo.hardwareModel = uaModel;
        deviceInfo.deviceModel = uaModel;
        
        // If manufacturer is generic, try to infer it from model prefix or UA
        const lowUA = navigator.userAgent.toLowerCase();
        if (normalizedManuf.includes('google inc') || normalizedManuf === 'unknown' || !normalizedManuf) {
          if (uaModel.startsWith('SM-') || uaModel.startsWith('GT-') || lowUA.includes('samsung')) deviceInfo.manufacturer = 'Samsung';
          else if (uaModel.startsWith('Pixel') || lowUA.includes('pixel')) deviceInfo.manufacturer = 'Google';
          else if (uaModel.startsWith('ONEPLUS') || lowUA.includes('oneplus')) deviceInfo.manufacturer = 'OnePlus';
          else if (uaModel.startsWith('CPH') || lowUA.includes('oppo')) deviceInfo.manufacturer = 'Oppo';
          else if (uaModel.startsWith('M21') || lowUA.includes('xiaomi') || lowUA.includes('redmi')) deviceInfo.manufacturer = 'Xiaomi';
          else if (lowUA.includes('moto') || lowUA.includes('motorola')) deviceInfo.manufacturer = 'Motorola';
          else if (lowUA.includes('huawei')) deviceInfo.manufacturer = 'Huawei';
        }
      } else {
        // Final fallback if UA parsing fails too - don't leave it as "K" or "Google Inc"
        deviceInfo.hardwareModel = 'Android Device';
        deviceInfo.deviceModel = 'Android Device';
        if (normalizedManuf.includes('google inc') || normalizedManuf === 'unknown') {
          deviceInfo.manufacturer = 'Android';
        }
      }
    }

    // Capitalize OS name consistently
    if (deviceInfo.os === 'android') deviceInfo.os = 'Android';
    if (deviceInfo.os === 'ios') deviceInfo.os = 'iOS';

    // Try to get public IP for mobile too
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      if (data.ip) deviceInfo.ipAddress = data.ip;
    } catch (e) {}

    return deviceInfo;
  } catch (error) {
    console.error('Error getting mobile device info:', error);
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    };
  }
}

/**
 * Get device information for web platform
 */
async function getWebDeviceInfo(): Promise<DeviceInfo> {
  const info: DeviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth,
    appVersion: '1.0.0', // Always provide a version for web too
  };
  
  // Parse user agent for browser/OS info
  const ua = navigator.userAgent;
  
  // Extract browser name and version
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    info.browser = 'Chrome';
    const match = ua.match(/Chrome\/([\d.]+)/);
    if (match) info.browserVersion = match[1];
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    info.browser = 'Safari';
    const match = ua.match(/Version\/([\d.]+)/);
    if (match) info.browserVersion = match[1];
  } else if (ua.includes('Firefox')) {
    info.browser = 'Firefox';
    const match = ua.match(/Firefox\/([\d.]+)/);
    if (match) info.browserVersion = match[1];
  } else if (ua.includes('Edg')) {
    info.browser = 'Edge';
    const match = ua.match(/Edg\/([\d.]+)/);
    if (match) info.browserVersion = match[1];
  }
  
  // Extract OS - PRIORITIZE MOBILE (Android/iOS) over Generic (Linux/Mac)
  if (ua.includes('Android')) {
    info.os = 'Android';
    // Extract specific hardware model from UA string
    const model = parseAndroidModel(ua);
    if (model) {
      info.hardwareModel = model;
      info.deviceModel = model;
    }
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    info.os = 'iOS';
  } else if (ua.includes('Windows') || navigator.platform.includes('Win')) {
    info.os = 'Windows';
  } else if (ua.includes('Mac') || navigator.platform.includes('Mac')) {
    info.os = 'macOS';
  } else if (ua.includes('Linux') || navigator.platform.includes('Linux')) {
    info.os = 'Linux';
  }

  // Use User-Agent Client Hints for more specific hardware info (Chrome/Edge/Opera)
  // This is the "Alternative idea" to get more specific hardware data
  if ((navigator as any).userAgentData && typeof (navigator as any).userAgentData.getHighEntropyValues === 'function') {
    try {
      const highEntropy = await (navigator as any).userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList', 'architecture']);
      if (highEntropy.model) info.deviceModel = highEntropy.model;
      if (highEntropy.architecture) info.platform = `${highEntropy.architecture} architecture`;
      
      // Some browsers might provide manufacturer in some hints but it's less standard
      // We can infer manufacturer for Apple/Windows based on hints
      if (info.os === 'macOS' || info.os === 'iOS') info.manufacturer = 'Apple';
      if (info.os === 'Windows') {
         // On Windows, the model field often contains the device name if set
      }
    } catch (e) {
      console.warn('Could not get high entropy hints', e);
    }
  }
  
  // Get available fonts (limited sample for fingerprinting)
  info.fonts = getAvailableFonts();
  
  // Get plugins
  info.plugins = Array.from(navigator.plugins || []).map(p => p.name);
  
  // Canvas fingerprint
  info.canvas = getCanvasFingerprint();
  
  // WebGL fingerprint
  info.webgl = getWebGLFingerprint();

  // Try to get public IP
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    if (data.ip) info.ipAddress = data.ip;
  } catch (e) {}
  
  return info;
}

/**
 * Generate a unique device identifier
 */
export async function generateDeviceIdentifier(): Promise<string> {
  const deviceType = await detectDeviceType();
  const PERSISTENT_ID_KEY = 'paradigm_device_id';
  
  // 1. Try to get from Capacitor Preferences (most stable for hybrid/native)
  try {
    const { value: storedId } = await Preferences.get({ key: PERSISTENT_ID_KEY });
    if (storedId) {
      return storedId.toLowerCase();
    }
  } catch (e) {
    console.error('Error reading from Preferences:', e);
  }

  // 2. Fallback to localStorage (and migrate to Preferences if found)
  const localId = localStorage.getItem(PERSISTENT_ID_KEY);
  if (localId) {
    const normalized = localId.toLowerCase();
    try {
      await Preferences.set({ key: PERSISTENT_ID_KEY, value: normalized });
    } catch (e) {}
    return normalized;
  }

  // 3. For mobile, try native hardware ID if nothing stored
  if (deviceType !== 'web') {
    try {
      const id = await Device.getId();
      if (id.identifier) {
        const nativeId = id.identifier.toLowerCase();
        // IMPORTANT: On mobile, we MUST use the native hardware ID. 
        // Do NOT fall back to a web fingerprint if this is available.
        await Preferences.set({ key: PERSISTENT_ID_KEY, value: nativeId });
        return nativeId;
      }
    } catch (e) {
      console.error('Error getting native ID:', e);
    }
    // If native ID fails for some reason, don't just generate a generic web fingerprint
    // that might collide with another similar phone. Use a timestamp-based unique one.
    const urgentId = `mob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return urgentId;
  }

  // 4. Generate new fingerprint as last resort
  const generatedId = await generateWebFingerprint();
  const newId = generatedId.toLowerCase();
  try {
    await Preferences.set({ key: PERSISTENT_ID_KEY, value: newId });
  } catch (e) {}
  localStorage.setItem(PERSISTENT_ID_KEY, newId);
  return newId;
}

/**
 * Generate web browser fingerprint with high entropy
 */
async function generateWebFingerprint(): Promise<string> {
  const info = await getWebDeviceInfo();
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(window.screen.width),
    String(window.screen.height),
    String(window.screen.colorDepth),
    new Date().getTimezoneOffset(),
    info.canvas || '',
    info.webgl || '',
    info.hardwareModel || '',
    info.deviceModel || '',
    (navigator as any).hardwareConcurrency || 'unknown',
    (navigator as any).deviceMemory || 'unknown',
  ];
  
  return hashString(components.join('|'));
}

/**
 * Generate fallback fingerprint when other methods fail
 */
function generateFallbackFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    String(window.screen.width),
    String(window.screen.height),
    String(new Date().getTimezoneOffset()),
  ];
  
  return hashString(components.join('|'));
}

// Cache fingerprints to avoid creating excessive WebGL contexts
let cachedCanvasFingerprint: string | null = null;
let cachedWebGLFingerprint: string | null = null;

/**
 * Get canvas fingerprint (cached)
 */
function getCanvasFingerprint(): string {
  // Return cached value if available
  if (cachedCanvasFingerprint !== null) {
    return cachedCanvasFingerprint;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cachedCanvasFingerprint = '';
      return '';
    }
    
    const text = 'Paradigm Device Fingerprint 🔒';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText(text, 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText(text, 4, 17);
    
    cachedCanvasFingerprint = canvas.toDataURL().substring(0, 50);
    return cachedCanvasFingerprint;
  } catch (error) {
    cachedCanvasFingerprint = '';
    return '';
  }
}

/**
 * Get WebGL fingerprint (cached)
 */
function getWebGLFingerprint(): string {
  // Return cached value if available
  if (cachedWebGLFingerprint !== null) {
    return cachedWebGLFingerprint;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
    if (!gl) {
      cachedWebGLFingerprint = '';
      return '';
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      cachedWebGLFingerprint = '';
      return '';
    }
    
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    cachedWebGLFingerprint = `${vendor}|${renderer}`.substring(0, 50);
    return cachedWebGLFingerprint;
  } catch (error) {
    cachedWebGLFingerprint = '';
    return '';
  }
}

/**
 * Get list of available fonts (sample)
 */
function getAvailableFonts(): string[] {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
    'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
    'Impact', 'Lucida Console'
  ];
  
  const available: string[] = [];
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return available;
  
  for (const font of testFonts) {
    let detected = false;
    for (const baseFont of baseFonts) {
      ctx.font = `12px "${font}", ${baseFont}`;
      const width = ctx.measureText('mmmmmmmmmmlli').width;
      
      ctx.font = `12px ${baseFont}`;
      const baseWidth = ctx.measureText('mmmmmmmmmmlli').width;
      
      if (width !== baseWidth) {
        detected = true;
        break;
      }
    }
    if (detected) {
      available.push(font);
    }
  }
  
  return available;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parse Android model from User Agent string
 */
function parseAndroidModel(ua: string): string | null {
  // Common pattern: (Linux; Android 10; SM-G981B) or (Linux; U; Android 9; CPH1907)
  const androidMatch = ua.match(/\(([^)]+)\)/);
  if (androidMatch && androidMatch[1]) {
    const parts = androidMatch[1].split(';');
    // Look for the part that's likely the model (usually at the end, and not 'Linux' or 'Android')
    for (let i = parts.length - 1; i >= 0; i--) {
      let part = parts[i].trim();
      
      // Aggressively strip build/version info from the part
      if (part.includes('Build/')) part = part.split('Build/')[0].trim();
      if (part.includes('build/')) part = part.split('build/')[0].trim();
      if (part.includes('Build')) part = part.split('Build')[0].trim();
      if (part.includes('build')) part = part.split('build')[0].trim();

      const lowPart = part.toLowerCase();
      
      // Skip if it's just the OS version part (e.g. "Android 10")
      if (lowPart.startsWith('android')) {
        // Only strip if it has a version number, else it might be "Android Device" name
        if (/\d/.test(part)) continue;
      }
      
      if (!lowPart.includes('linux') && 
          !lowPart.includes('wv') && // Exclude WebView markers
          !lowPart.includes('version') &&
          part.length > 2 &&
          part.length < 35) {
        
        return part;
      }
    }
  }
  return null;
}

/**
 * Map common Samsung/Android model numbers to friendly names
 */
function getFriendlyModelName(model: string): string {
  if (!model || model === 'K' || model === 'unknown' || model.includes('Android SDK')) return 'Android Device';
  
  const modelUpper = model.toUpperCase();
  
  // Clean up model names that might still have extra info
  const cleanedModel = modelUpper.split(' ').filter(word => 
    !['WV', 'BUILD', 'VERSION', 'RELEASE'].includes(word)
  ).join(' ');

  // Samsung Fold/Flip Series
  if (cleanedModel.includes('SM-F936') || cleanedModel.includes('F936')) return 'Samsung Fold 4';
  if (cleanedModel.includes('SM-F946') || cleanedModel.includes('F946')) return 'Samsung Fold 5';
  if (cleanedModel.includes('SM-F721') || cleanedModel.includes('F721')) return 'Samsung Flip 4';
  if (cleanedModel.includes('SM-F731') || cleanedModel.includes('F731')) return 'Samsung Flip 5';
  
  // Samsung S Series
  if (cleanedModel.includes('SM-S901')) return 'Samsung S22';
  if (cleanedModel.includes('SM-S911')) return 'Samsung S23';
  if (cleanedModel.includes('SM-S921')) return 'Samsung S24';
  if (cleanedModel.includes('SM-S908')) return 'Samsung S22 Ultra';
  if (cleanedModel.includes('SM-S918')) return 'Samsung S23 Ultra';
  if (cleanedModel.includes('SM-S928')) return 'Samsung S24 Ultra';
  if (cleanedModel.includes('SM-G98')) return 'Samsung S20';
  if (cleanedModel.includes('SM-G99')) return 'Samsung S21';
  
  // Pixel Series
  if (cleanedModel.includes('PIXEL 4')) return 'Google Pixel 4';
  if (cleanedModel.includes('PIXEL 5')) return 'Google Pixel 5';
  if (cleanedModel.includes('PIXEL 6')) return 'Google Pixel 6';
  if (cleanedModel.includes('PIXEL 7')) return 'Google Pixel 7';
  if (cleanedModel.includes('PIXEL 8')) return 'Google Pixel 8';

  return model;
}

/**
 * Generate a user-friendly device name
 */
export async function generateDeviceName(): Promise<string> {
  const deviceType = await detectDeviceType();
  const info = await getDeviceInfo();
  
  if (deviceType === 'web') {
    const browser = info.browser || 'Browser';
    const os = info.os || info.platform || 'Unknown OS';
    const hwModel = info.hardwareModel || info.deviceModel;
    
    if (os === 'Android' && hwModel) {
      return `${getFriendlyModelName(hwModel)} (${browser})`;
    }
    
    if (os === 'iOS' && hwModel) {
      return `${hwModel} (${browser})`;
    }

    return `${browser} on ${os}`;
  } else {
    // Clean up mobile names (avoid messy UserAgent strings in titles)
    let model = info.deviceModel || '';
    let manufacturer = info.manufacturer || '';

    // Sanitize manufacturer
    if (manufacturer.includes('Mozilla') || manufacturer.toLowerCase().includes('unknown')) {
       manufacturer = '';
    }
    if (manufacturer === 'Google Inc') manufacturer = 'Google';

    // Sanitize model
    if (model.includes('Mozilla') || model.length > 30 || model.toLowerCase().includes('unknown')) {
       model = '';
    }

    // Build friendly name
    const hwModel = info.hardwareModel;
    if (deviceType === 'android') {
      let name = '';
      const workingModel = hwModel || model;
      
      if (workingModel) {
        const friendly = getFriendlyModelName(workingModel);
        if (manufacturer && !friendly.toLowerCase().includes(manufacturer.toLowerCase())) {
          name = `${manufacturer} ${friendly}`;
        } else {
          name = friendly;
        }
      } else if (manufacturer) {
        name = `${manufacturer} Android`;
      } else {
        name = 'Android Device';
      }

      // Final fallback if name is still too short or "K"
      if (name.length <= 2) {
        return `Android ${name}`;
      }
      return name;
    } else { // iOS or other mobile
      let name = '';
      if (model && manufacturer) {
        name = manufacturer.toLowerCase().includes(model.toLowerCase()) ? model : `${manufacturer} ${model}`;
      } else if (model) {
        name = model;
      } else if (manufacturer) {
        name = `${manufacturer} iOS`;
      } else if (hwModel) {
        name = `${hwModel} iOS`;
      } else {
        name = 'iOS Device';
      }

      if (name.length <= 2) {
        return `iOS ${name}`;
      }
      return name;
    }
  }
}
