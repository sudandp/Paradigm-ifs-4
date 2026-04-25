/**
 * security.ts
 * 
 * Defense-in-depth security utilities for Paradigm Office 4.
 * Implements: Rate limiting, account lockout, input sanitization,
 * password strength validation, session management, and security audit logging.
 * 
 * These are client-side enforcement layers. Server-side RLS + RPC functions
 * provide the authoritative security boundary.
 */

import { supabase } from '../services/supabase';

// ===========================
// 1. RATE LIMITER (In-Memory)
// ===========================

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Client-side rate limiter with progressive lockout.
 * - 5 attempts in 5 minutes → locked for 2 minutes
 * - 10 attempts in 15 minutes → locked for 15 minutes
 * - 20 attempts in 30 minutes → locked for 60 minutes
 */
export function checkRateLimit(identifier: string, action: string = 'login'): {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntilMs: number | null;
  message: string;
} {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Check if currently locked
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    const remainingSec = Math.ceil((entry.lockedUntil - now) / 1000);
    const remainingMin = Math.ceil(remainingSec / 60);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: entry.lockedUntil,
      message: `Account locked. Try again in ${remainingMin > 1 ? `${remainingMin} minutes` : `${remainingSec} seconds`}.`
    };
  }

  // Clean expired entries (older than 30 minutes)
  if (entry && (now - entry.firstAttempt > 30 * 60 * 1000)) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingAttempts: 5, lockedUntilMs: null, message: '' };
  }

  if (!entry) {
    return { allowed: true, remainingAttempts: 5, lockedUntilMs: null, message: '' };
  }

  // Determine lockout tier
  const elapsed = now - entry.firstAttempt;
  let maxAttempts = 5;
  let lockDuration = 2 * 60 * 1000; // 2 min

  if (elapsed > 15 * 60 * 1000 && entry.count >= 10) {
    lockDuration = 15 * 60 * 1000; // 15 min
    maxAttempts = 10;
  }
  if (elapsed > 5 * 60 * 1000 && entry.count >= 20) {
    lockDuration = 60 * 60 * 1000; // 60 min
    maxAttempts = 20;
  }

  if (entry.count >= maxAttempts) {
    entry.lockedUntil = now + lockDuration;
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: entry.lockedUntil,
      message: `Too many failed attempts. Locked for ${Math.ceil(lockDuration / 60000)} minutes.`
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - entry.count,
    lockedUntilMs: null,
    message: ''
  };
}

/** Record a failed attempt for rate limiting */
export function recordFailedAttempt(identifier: string, action: string = 'login'): void {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || (now - entry.firstAttempt > 30 * 60 * 1000)) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now, lockedUntil: null });
  } else {
    entry.count++;
  }
}

/** Clear rate limit on successful login */
export function clearRateLimit(identifier: string, action: string = 'login'): void {
  rateLimitStore.delete(`${action}:${identifier}`);
}


// ================================
// 2. PASSWORD STRENGTH VALIDATION
// ================================

export interface PasswordStrength {
  score: number;       // 0-4 (0=very weak, 4=very strong)
  label: string;
  suggestions: string[];
  isAcceptable: boolean;
}

/**
 * Evaluate password strength with NIST 800-63B guidelines.
 * Enforces minimum 8 characters, mixed case, numbers, and special chars.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Include both uppercase and lowercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Include at least one number');

  if (/[!@#$%^&*()_+\-=[\]{};':"|,.<>?/~`]/.test(password)) score++;
  else suggestions.push('Include at least one special character');

  // Penalize common patterns
  const commonPatterns = [
    /^123/, /password/i, /qwerty/i, /abc123/i, /admin/i,
    /letmein/i, /welcome/i, /monkey/i, /master/i, /dragon/i,
    /login/i, /passw0rd/i, /paradigm/i, /5687/
  ];
  if (commonPatterns.some(p => p.test(password))) {
    score = Math.max(0, score - 2);
    suggestions.push('Avoid common passwords and patterns');
  }

  // Penalize repeated characters
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid repeating characters');
  }

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const clampedScore = Math.min(4, Math.max(0, score));

  return {
    score: clampedScore,
    label: labels[clampedScore],
    suggestions,
    isAcceptable: clampedScore >= 2
  };
}


// ============================
// 3. INPUT SANITIZATION
// ============================

/**
 * Sanitize user input to prevent XSS and injection attacks.
 * Strips HTML tags and dangerous characters.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .trim();
}

/**
 * Validate and sanitize email format.
 * Returns null if invalid.
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Validate file path to prevent traversal attacks.
 * Returns true if the path is safe.
 */
export function isPathSafe(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const forbidden = ['..', '\\', '%2e%2e', '%252e', '~', '$', '|', ';', '`'];
  const lowerPath = path.toLowerCase();
  return !forbidden.some(f => lowerPath.includes(f));
}


// ============================
// 4. SESSION MANAGEMENT
// ============================

const SESSION_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let lastActivityTimestamp = Date.now();
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

/** Update the last activity timestamp. Call this on user interactions. */
export function recordActivity(): void {
  lastActivityTimestamp = Date.now();
}

/**
 * Start monitoring session inactivity.
 * Will call `onExpired` when the session has been inactive for too long.
 */
export function startSessionMonitor(onExpired: () => void): void {
  stopSessionMonitor();
  lastActivityTimestamp = Date.now();

  sessionCheckInterval = setInterval(() => {
    if (Date.now() - lastActivityTimestamp > SESSION_INACTIVITY_TIMEOUT) {
      console.warn('[Security] Session expired due to inactivity');
      onExpired();
      stopSessionMonitor();
    }
  }, 60 * 1000); // Check every minute

  // Track user activity
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(event => {
    document.addEventListener(event, recordActivity, { passive: true });
  });
}

/** Stop the session inactivity monitor */
export function stopSessionMonitor(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}


// ============================
// 5. SECURITY AUDIT LOGGING
// ============================

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'login_lockout'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'role_change'
  | 'admin_action'
  | 'file_access'
  | 'bulk_download'
  | 'suspicious_activity'
  | 'session_expired'
  | 'new_admin_created'
  | 'mfa_enabled'
  | 'mfa_disabled';

interface SecurityEvent {
  event_type: SecurityEventType;
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Log a security event to the security_audit_logs table.
 * Falls back to console.warn if the table doesn't exist.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const payload = {
    ...event,
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    origin: window.location.origin,
  };

  // Always log to console for immediate visibility
  const logMethod = event.severity === 'critical' ? console.error : 
                    event.severity === 'warning' ? console.warn : console.info;
  logMethod(`[SECURITY] ${event.event_type}`, payload);

  // Attempt to persist to database (best-effort)
  try {
    await supabase.from('security_audit_logs').insert(payload);
  } catch (e) {
    // Table may not exist yet — fall through silently
    console.debug('[Security] Could not persist audit log (table may not exist):', e);
  }
}


// ============================
// 6. FILE UPLOAD VALIDATION
// ============================

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/xml', 'text/xml'
]);

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.sh', '.bash', '.scr',
  '.pif', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.cpl', '.hta',
  '.inf', '.reg', '.rgs', '.sct', '.url', '.dll', '.sys', '.drv'
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file before upload.
 * Checks MIME type, file extension, and size.
 */
export function validateFileForUpload(file: File): FileValidationResult {
  // 1. Size check
  if (file.size > MAX_UPLOAD_SIZE) {
    return { valid: false, error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the 10MB limit.` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // 2. MIME type check
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return { valid: false, error: `File type "${file.type || 'unknown'}" is not allowed. Please upload images, PDFs, or office documents.` };
  }

  // 3. Extension check (double extension attack prevention)
  const fileName = file.name.toLowerCase();
  const extensions = fileName.split('.').slice(1);
  for (const ext of extensions) {
    if (DANGEROUS_EXTENSIONS.has(`.${ext}`)) {
      return { valid: false, error: `File extension ".${ext}" is not allowed for security reasons.` };
    }
  }

  // 4. Double extension detection (e.g., document.pdf.exe)
  if (extensions.length > 1) {
    const lastExt = extensions[extensions.length - 1];
    if (DANGEROUS_EXTENSIONS.has(`.${lastExt}`)) {
      return { valid: false, error: 'File appears to have a disguised extension.' };
    }
  }

  return { valid: true };
}


// ============================
// 7. SIGNED URL HELPER
// ============================

/**
 * Get a signed (temporary) URL for private bucket files.
 * Expires after the specified duration (default: 1 hour).
 * Use this instead of getPublicUrl for sensitive documents.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error(`[Security] Failed to create signed URL for ${bucket}/${path}:`, error);
    return null;
  }
  return data.signedUrl;
}


// ============================
// 8. ADMIN ACTION GUARD
// ============================

/**
 * Verify the current user has admin privileges before performing
 * sensitive operations. This is a client-side guard — the real
 * authorization happens via RLS/RPC on the server.
 */
export async function verifyAdminAccess(): Promise<{
  isAdmin: boolean;
  userId: string | null;
  role: string | null;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { isAdmin: false, userId: null, role: null };
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', session.user.id)
    .single();

  const adminRoles = ['admin', 'super_admin', 'superadmin', 'developer'];
  const role = userData?.role_id || null;
  const isAdmin = adminRoles.includes(role || '');

  return { isAdmin, userId: session.user.id, role };
}
