import { StaffPayAccount } from '../types/cloud';
import { db } from '../db/database';

const ACCOUNTS_STORAGE_KEY = 'staffpay_registered_accounts';
const ACTIVE_ACCOUNT_KEY = 'staffpay_active_account_id';
const PBKDF2_ITERATIONS = 100000;

export class AccountService {
  /**
   * Generates a random cryptographic salt (hex string)
   */
  private static generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hashes a password with PBKDF2-HMAC-SHA256 using Web Crypto API
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const hashArray = Array.from(new Uint8Array(derivedKey));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a stable unique account ID
   */
  static generateAccountId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `sp_${timestamp}_${random}`;
  }

  /**
   * Gets all registered accounts stored locally
   */
  static getAccounts(): StaffPayAccount[] {
    try {
      const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to parse registered accounts:', e);
    }
    return [];
  }

  /**
   * Saves accounts list to storage
   */
  private static saveAccounts(accounts: StaffPayAccount[]): void {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  }

  /**
   * Gets the currently authenticated / active StaffPay account
   */
  static getActiveAccount(): StaffPayAccount | null {
    const activeId = sessionStorage.getItem(ACTIVE_ACCOUNT_KEY) || localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!activeId) return null;

    const accounts = this.getAccounts();
    return accounts.find((a) => a.accountId === activeId) || null;
  }

  /**
   * Checks if any account is currently logged in
   */
  static isAuthenticated(): boolean {
    return Boolean(this.getActiveAccount());
  }

  /**
   * Registers a new StaffPay account
   */
  static async createAccount(
    usernameInput: string,
    passwordInput: string,
    companyName?: string
  ): Promise<StaffPayAccount> {
    const username = usernameInput.trim().toLowerCase();
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!passwordInput || passwordInput.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const accounts = this.getAccounts();
    const existing = accounts.find((a) => a.username.toLowerCase() === username);
    if (existing) {
      throw new Error(`Account with username "${username}" already exists. Please sign in instead.`);
    }

    const salt = this.generateSalt();
    const hash = await this.hashPassword(passwordInput, salt);
    const now = new Date().toISOString();

    const newAccount: StaffPayAccount = {
      accountId: this.generateAccountId(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      companyName: companyName?.trim() || 'My Business',
    };

    accounts.push(newAccount);
    this.saveAccounts(accounts);
    this.setActiveAccount(newAccount);

    return newAccount;
  }

  /**
   * Authenticates a StaffPay account with username + password
   */
  static async authenticate(usernameInput: string, passwordInput: string): Promise<StaffPayAccount> {
    const username = usernameInput.trim().toLowerCase();
    if (!username || !passwordInput) {
      throw new Error('Please enter both username and password.');
    }

    const accounts = this.getAccounts();
    let account = accounts.find((a) => a.username.toLowerCase() === username);

    // If accounts list is empty on this device, check default admin or allow initial account creation
    if (!account) {
      if (accounts.length === 0 && username === 'admin' && passwordInput === 'admin123') {
        // Auto-seed initial default admin on brand new device
        return this.createAccount('admin', 'admin123', 'StaffPay Business');
      }
      throw new Error('Invalid username or password. If you are new, click "Create Account".');
    }

    const computedHash = await this.hashPassword(passwordInput, account.passwordSalt);
    if (computedHash !== account.passwordHash) {
      throw new Error('Invalid username or password.');
    }

    this.setActiveAccount(account);
    return account;
  }

  /**
   * Sets the active session account
   */
  static setActiveAccount(account: StaffPayAccount): void {
    sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, account.accountId);
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.accountId);
  }

  /**
   * Logs out the current active account and safely unlinks active session
   */
  static async logout(): Promise<void> {
    sessionStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }

  /**
   * Isolate and clear local working database when switching accounts
   */
  static async switchAccountClearCache(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.employees,
        db.attendance,
        db.leave_types,
        db.leaves,
        db.holidays,
        db.salary_records,
        db.settings,
      ],
      async () => {
        await db.employees.clear();
        await db.attendance.clear();
        await db.leave_types.clear();
        await db.leaves.clear();
        await db.holidays.clear();
        await db.salary_records.clear();
        await db.settings.clear();
      }
    );
  }
}
