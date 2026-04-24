/**
 * secureStorage.ts
 * 
 * AES-256 encrypted wrapper around Capacitor Preferences and localStorage.
 * Sensitive data (tokens, emails, device IDs) must never be stored in plaintext.
 * 
 * Key is derived from the app bundle ID + a device-unique salt stored in
 * plain preferences (not sensitive on its own — only the encrypted payload is).
 */

import CryptoJS from 'crypto-js';
import { Preferences } from '@capacitor/preferences';

const SALT_KEY = '_app_enc_salt_';
const APP_ID = 'com.paradigm.services.onboarding'; // matches capacitor.config.ts appId

// ---------- Key Derivation ----------

let _cachedKey: string | null = null;

async function getDerivedKey(): Promise<string> {
    if (_cachedKey) return _cachedKey;

    // Load or create device-unique salt
    let { value: salt } = await Preferences.get({ key: SALT_KEY });
    if (!salt) {
        salt = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
        await Preferences.set({ key: SALT_KEY, value: salt });
    }

    // Derive a 256-bit key using PBKDF2
    const key = CryptoJS.PBKDF2(APP_ID, salt, {
        keySize: 256 / 32,
        iterations: 1000,
    }).toString(CryptoJS.enc.Hex);

    _cachedKey = key;
    return key;
}

// ---------- Encrypt / Decrypt ----------

function encrypt(plaintext: string, key: string): string {
    return CryptoJS.AES.encrypt(plaintext, key).toString();
}

function decrypt(ciphertext: string, key: string): string | null {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const result = bytes.toString(CryptoJS.enc.Utf8);
        return result || null;
    } catch {
        return null;
    }
}

// ---------- Secure Preferences (Capacitor) ----------

/**
 * Store a sensitive value encrypted in Capacitor Preferences.
 * Use for: refresh tokens, auth emails, PINs, etc.
 */
export async function secureSet(key: string, value: string): Promise<void> {
    const derivedKey = await getDerivedKey();
    const ciphertext = encrypt(value, derivedKey);
    await Preferences.set({ key: `_sec_${key}`, value: ciphertext });
}

/**
 * Retrieve and decrypt a sensitive value from Capacitor Preferences.
 * Returns null if the key doesn't exist or decryption fails.
 */
export async function secureGet(key: string): Promise<string | null> {
    const { value: ciphertext } = await Preferences.get({ key: `_sec_${key}` });
    if (!ciphertext) return null;
    const derivedKey = await getDerivedKey();
    return decrypt(ciphertext, derivedKey);
}

/**
 * Remove a secure value from Capacitor Preferences.
 */
export async function secureRemove(key: string): Promise<void> {
    await Preferences.remove({ key: `_sec_${key}` });
}

// ---------- Secure localStorage ----------

/**
 * Store a non-critical but mildly-sensitive value encrypted in localStorage.
 * Use for: device fingerprints, notification configs, cached route paths.
 * 
 * NOTE: This is synchronous encryption with a static key derived at call-time.
 * For highly sensitive data (tokens), always use secureSet/secureGet instead.
 */
const LS_STATIC_KEY = `${APP_ID}_ls_enc`;

export function secureLocalSet(key: string, value: string): void {
    try {
        const ciphertext = CryptoJS.AES.encrypt(value, LS_STATIC_KEY).toString();
        localStorage.setItem(`_sec_${key}`, ciphertext);
    } catch {
        // Fallback to plaintext if crypto fails (should never happen)
        localStorage.setItem(key, value);
    }
}

export function secureLocalGet(key: string): string | null {
    try {
        const ciphertext = localStorage.getItem(`_sec_${key}`);
        if (!ciphertext) return null;
        const bytes = CryptoJS.AES.decrypt(ciphertext, LS_STATIC_KEY);
        return bytes.toString(CryptoJS.enc.Utf8) || null;
    } catch {
        // Fallback: attempt to read unencrypted legacy value
        return localStorage.getItem(key);
    }
}

export function secureLocalRemove(key: string): void {
    localStorage.removeItem(`_sec_${key}`);
    localStorage.removeItem(key); // also clean up any legacy plaintext key
}
