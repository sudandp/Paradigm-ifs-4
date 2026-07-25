import { Preferences } from '@capacitor/preferences';

export class SecureVault {
  private static PREFIX = 'paradigm_secure_vault_';

  public static async setItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({
        key: `${this.PREFIX}${key}`,
        value: value
      });
    } catch (e) {
      console.warn('[SecureVault] Native preferences fallback to localStorage:', e);
      localStorage.setItem(`${this.PREFIX}${key}`, value);
    }
  }

  public static async getItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({
        key: `${this.PREFIX}${key}`
      });
      if (value !== null) return value;
    } catch (e) {
      console.warn('[SecureVault] Native preferences get error:', e);
    }
    return localStorage.getItem(`${this.PREFIX}${key}`);
  }

  public static async removeItem(key: string): Promise<void> {
    try {
      await Preferences.remove({
        key: `${this.PREFIX}${key}`
      });
    } catch (e) {
      console.warn('[SecureVault] Native preferences remove error:', e);
    }
    localStorage.removeItem(`${this.PREFIX}${key}`);
  }

  public static async clearAllVaultTokens(): Promise<void> {
    const keys = ['auth_token', 'refresh_token', 'user_session', 'biometric_credentials'];
    for (const k of keys) {
      await this.removeItem(k);
    }
  }
}
