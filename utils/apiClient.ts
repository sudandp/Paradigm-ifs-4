import { Capacitor } from '@capacitor/core';

/**
 * Production base URL used by native shells when making HTTP API calls
 * to the backend Express server.
 */
const DEFAULT_PROD_API = 'https://app.paradigmfms.com';

/**
 * Returns the resolved API URL for a given relative or absolute path.
 * 
 * - In Web Browser: returns relative path (or uses Vite dev proxy).
 * - In Native Shell (Android / iOS): prepends live backend server base URL.
 */
export function getApiUrl(path: string): string {
  if (!path) return path;

  // If already an absolute URL (http/https), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (Capacitor.isNativePlatform()) {
    const baseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || DEFAULT_PROD_API;
    return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
  }

  return cleanPath;
}

/**
 * Safe fetch wrapper that automatically routes relative API calls to
 * the production server when running inside a native Capacitor shell.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url: RequestInfo | URL = input;

  if (typeof input === 'string') {
    url = getApiUrl(input);
  }

  return fetch(url, init);
}
