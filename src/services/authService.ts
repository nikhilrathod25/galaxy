import { SettingsRepository } from '../repositories/settingsRepository';
import { AuthSettings } from '../types';

const SESSION_AUTH_KEY = 'staffpay_session_unlocked';

export class AuthService {
  /**
   * Lightweight client-side hash (SHA-256 via Web Crypto API)
   */
  private static async hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_staffpay_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Returns current auth settings
   */
  static async getAuthSettings(): Promise<AuthSettings> {
    return SettingsRepository.getAuthSettings();
  }

  /**
   * Checks if PIN lock is enabled
   */
  static async isPinSet(): Promise<boolean> {
    const auth = await this.getAuthSettings();
    return auth.pinEnabled && Boolean(auth.pinHash);
  }

  /**
   * Sets up or updates the Admin PIN
   */
  static async setPin(newPin: string): Promise<void> {
    const hash = await this.hashPin(newPin);
    await SettingsRepository.saveAuthSettings({
      pinEnabled: true,
      pinHash: hash,
    });
    this.setSessionUnlocked(true);
  }

  /**
   * Disables PIN protection
   */
  static async disablePin(): Promise<void> {
    await SettingsRepository.saveAuthSettings({
      pinEnabled: false,
      pinHash: '',
    });
    this.setSessionUnlocked(true);
  }

  /**
   * Verifies an entered PIN against stored hash
   */
  static async verifyPin(enteredPin: string): Promise<boolean> {
    const auth = await this.getAuthSettings();
    if (!auth.pinEnabled || !auth.pinHash) {
      return true;
    }
    const hash = await this.hashPin(enteredPin);
    const isValid = hash === auth.pinHash;
    if (isValid) {
      this.setSessionUnlocked(true);
      await SettingsRepository.saveAuthSettings({
        ...auth,
        lastLoginAt: new Date().toISOString(),
      });
    }
    return isValid;
  }

  /**
   * Session unlock state helpers
   */
  static isSessionUnlocked(): boolean {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  }

  static setSessionUnlocked(unlocked: boolean): void {
    if (unlocked) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
  }

  static lockSession(): void {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
  }
}
