import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
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
    return accounts.find((a) => a.accountId === activeId || a.username === activeId) || null;
  }

  /**
   * Checks if any account is currently logged in
   */
  static isAuthenticated(): boolean {
    return Boolean(this.getActiveAccount());
  }

  /**
   * Registers a new StaffPay account on Cloud Firestore & locally
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

    // 1. Check Cloud Firestore if username already exists
    const userDocRef = doc(firestore, 'users', username);
    try {
      const cloudSnap = await getDoc(userDocRef);
      if (cloudSnap.exists()) {
        throw new Error(`Username "${username}" is already registered. Please Sign In instead.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('already registered')) {
        throw err;
      }
      console.warn('Cloud pre-check notice:', err);
    }

    const salt = this.generateSalt();
    const hash = await this.hashPassword(passwordInput, salt);
    const now = new Date().toISOString();
    const accountId = `sp_${username}`;

    const newAccount: StaffPayAccount = {
      accountId,
      username,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      companyName: companyName?.trim() || 'StaffPay Business',
    };

    // 2. Save directly to Cloud Firestore
    try {
      await setDoc(userDocRef, {
        accountId,
        username,
        passwordHash: hash,
        passwordSalt: salt,
        companyName: newAccount.companyName,
        createdAt: now,
        updatedAt: now,
        status: 'active',
      });
    } catch (cloudWriteErr) {
      console.warn('Cloud account registration write error:', cloudWriteErr);
    }

    // 3. Save locally
    const accounts = this.getAccounts();
    const existingIndex = accounts.findIndex((a) => a.username === username);
    if (existingIndex >= 0) {
      accounts[existingIndex] = newAccount;
    } else {
      accounts.push(newAccount);
    }
    this.saveAccounts(accounts);
    this.setActiveAccount(newAccount);

    return newAccount;
  }

  /**
   * Authenticates a StaffPay account with username + password against Cloud Firestore & local cache
   */
  static async authenticate(usernameInput: string, passwordInput: string): Promise<StaffPayAccount> {
    const username = usernameInput.trim().toLowerCase();
    if (!username || !passwordInput) {
      throw new Error('Please enter both username and password.');
    }

    // 1. Attempt Cloud Firestore authentication
    const userDocRef = doc(firestore, 'users', username);
    try {
      const cloudSnap = await getDoc(userDocRef);
      if (cloudSnap.exists()) {
        const cloudData = cloudSnap.data();
        const computedHash = await this.hashPassword(passwordInput, cloudData.passwordSalt);
        if (computedHash === cloudData.passwordHash) {
          const account: StaffPayAccount = {
            accountId: cloudData.accountId || `sp_${username}`,
            username: cloudData.username || username,
            passwordHash: cloudData.passwordHash,
            passwordSalt: cloudData.passwordSalt,
            createdAt: cloudData.createdAt || new Date().toISOString(),
            updatedAt: cloudData.updatedAt || new Date().toISOString(),
            status: 'active',
            companyName: cloudData.companyName || 'StaffPay Business',
          };

          // Cache locally
          const accounts = this.getAccounts();
          const existingIndex = accounts.findIndex((a) => a.username === username);
          if (existingIndex >= 0) {
            accounts[existingIndex] = account;
          } else {
            accounts.push(account);
          }
          this.saveAccounts(accounts);
          this.setActiveAccount(account);
          return account;
        } else {
          throw new Error('Incorrect password. Please try again.');
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect password')) {
        throw err;
      }
      console.warn('Cloud login check notice:', err);
    }

    // 2. Fallback to local accounts list
    const accounts = this.getAccounts();
    const localAccount = accounts.find((a) => a.username.toLowerCase() === username);

    if (localAccount && localAccount.passwordSalt && localAccount.passwordHash) {
      const computedHash = await this.hashPassword(passwordInput, localAccount.passwordSalt);
      if (computedHash === localAccount.passwordHash) {
        this.setActiveAccount(localAccount);
        // Sync to cloud in background
        setDoc(userDocRef, {
          accountId: localAccount.accountId,
          username: localAccount.username,
          passwordHash: localAccount.passwordHash,
          passwordSalt: localAccount.passwordSalt,
          companyName: localAccount.companyName,
          createdAt: localAccount.createdAt,
          updatedAt: new Date().toISOString(),
          status: 'active',
        }).catch(() => {});
        return localAccount;
      } else {
        throw new Error('Incorrect password. Please try again.');
      }
    }

    throw new Error(`Account "${username}" not found. Please click "Create Account" tab to register.`);
  }

  /**
   * Syncs all local registered accounts to Cloud Firestore so any device can authenticate
   */
  static async syncAllLocalAccountsToCloud(): Promise<void> {
    const accounts = this.getAccounts();
    for (const acc of accounts) {
      if (acc.username && acc.passwordHash && acc.passwordSalt) {
        try {
          const userDocRef = doc(firestore, 'users', acc.username.toLowerCase().trim());
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            await setDoc(userDocRef, {
              accountId: acc.accountId,
              username: acc.username.toLowerCase().trim(),
              passwordHash: acc.passwordHash,
              passwordSalt: acc.passwordSalt,
              companyName: acc.companyName || 'StaffPay Business',
              createdAt: acc.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'active',
            });
          }
        } catch (e) {
          console.warn('Account cloud sync warning:', e);
        }
      }
    }
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
