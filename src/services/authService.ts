import { supabase } from './supabase';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  user_metadata?: {
    username?: string;
    role?: string;
  };
}

interface StoredAdminAuth {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
  updatedAt?: string;
}

interface AdminSession {
  id: string;
  username: string;
  token: string;
  loginAt: number;
}

const SESSION_STORAGE_KEY = 'staffpay_admin_session';

type AuthStateChangeCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: AdminSession | null) => void;

export class AuthService {
  private static currentUser: AdminUser | null = null;
  private static currentSession: AdminSession | null = null;
  private static isInitialized = false;
  private static listeners: Set<AuthStateChangeCallback> = new Set();

  /**
   * Hashes a password with salt using PBKDF2-SHA256 via Web Crypto API (100,000 iterations)
   */
  private static async hashPassword(password: string, saltHex: string): Promise<string> {
    const enc = new TextEncoder();
    const saltBytes = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a cryptographically secure 16-byte random salt
   */
  private static generateSalt(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a random session token
   */
  private static generateToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Fetches the current Admin Auth record stored in Supabase settings table
   */
  static async getStoredAdminAuth(): Promise<StoredAdminAuth | null> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin_auth')
        .maybeSingle();

      if (error || !data || !data.value) {
        return null;
      }
      return data.value as StoredAdminAuth;
    } catch (e) {
      console.error('Error fetching admin credentials from Supabase:', e);
      return null;
    }
  }

  /**
   * Initializes authentication state from local storage and validates session
   */
  static async initialize(): Promise<AdminUser | null> {
    if (this.isInitialized && this.currentUser) {
      return this.currentUser;
    }

    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const session: AdminSession = JSON.parse(stored);
        if (session && session.username && session.token) {
          this.currentSession = session;
          this.currentUser = {
            id: session.id || 'admin',
            username: session.username,
            email: `${session.username}@staffpay.app`,
            user_metadata: {
              username: session.username,
              role: 'admin',
            },
          };
          this.isInitialized = true;
          return this.currentUser;
        }
      }
    } catch (e) {
      console.warn('Session parse notice:', e);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }

    this.currentSession = null;
    this.currentUser = null;
    this.isInitialized = true;
    return null;
  }

  /**
   * Subscribes to Admin Auth state changes
   */
  static onAuthStateChange(callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: AdminSession | null) => void) {
    this.listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          },
        },
      },
    };
  }

  private static notifyListeners(event: 'SIGNED_IN' | 'SIGNED_OUT', session: AdminSession | null) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session);
      } catch (e) {
        console.error('Auth state listener error:', e);
      }
    });
  }

  /**
   * Logs in the Admin with username and password.
   * If the Admin account does not exist in Supabase yet, automatically registers it.
   */
  static async login(usernameInput: string, passwordInput: string): Promise<AdminUser> {
    const username = usernameInput.trim();
    if (!username || !passwordInput) {
      throw new Error('Please enter both username and password.');
    }
    if (passwordInput.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    // 1. Fetch admin credentials from Supabase settings table
    const storedAuth = await this.getStoredAdminAuth();

    if (!storedAuth) {
      // First time setup: Automatically register this Admin in Supabase PostgreSQL
      const salt = this.generateSalt();
      const hash = await this.hashPassword(passwordInput, salt);
      const newAuth: StoredAdminAuth = {
        username,
        salt,
        hash,
        createdAt: new Date().toISOString(),
      };

      const { error } = await supabase.from('settings').upsert(
        {
          key: 'admin_auth',
          value: newAuth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

      if (error) {
        console.error('Error creating admin credentials in Supabase:', error);
        throw new Error('Failed to initialize Admin credentials in Supabase database.');
      }

      // Establish session
      const session: AdminSession = {
        id: 'admin',
        username,
        token: this.generateToken(),
        loginAt: Date.now(),
      };

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      this.currentSession = session;
      this.currentUser = {
        id: 'admin',
        username,
        email: `${username}@staffpay.app`,
        user_metadata: {
          username,
          role: 'admin',
        },
      };

      this.notifyListeners('SIGNED_IN', session);
      return this.currentUser;
    }

    // 2. Existing Admin: Verify username
    if (storedAuth.username.toLowerCase() !== username.toLowerCase()) {
      throw new Error('Invalid username or password.');
    }

    // 3. Verify password hash
    const computedHash = await this.hashPassword(passwordInput, storedAuth.salt);
    if (computedHash !== storedAuth.hash) {
      throw new Error('Invalid username or password.');
    }

    // 4. Successful login: Establish session
    const session: AdminSession = {
      id: 'admin',
      username: storedAuth.username,
      token: this.generateToken(),
      loginAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    this.currentSession = session;
    this.currentUser = {
      id: 'admin',
      username: storedAuth.username,
      email: `${storedAuth.username}@staffpay.app`,
      user_metadata: {
        username: storedAuth.username,
        role: 'admin',
      },
    };

    this.notifyListeners('SIGNED_IN', session);
    return this.currentUser;
  }

  /**
   * Updates Admin credentials in Supabase settings table
   */
  static async updateCredentials(
    currentPassword: string,
    newUsername: string,
    newPassword?: string
  ): Promise<void> {
    const storedAuth = await this.getStoredAdminAuth();
    if (!storedAuth) {
      throw new Error('No admin account found in cloud database.');
    }

    const computedHash = await this.hashPassword(currentPassword, storedAuth.salt);
    if (computedHash !== storedAuth.hash) {
      throw new Error('Current password does not match.');
    }

    let finalSalt = storedAuth.salt;
    let finalHash = storedAuth.hash;

    if (newPassword && newPassword.trim().length >= 4) {
      finalSalt = this.generateSalt();
      finalHash = await this.hashPassword(newPassword.trim(), finalSalt);
    }

    const updatedAuth: StoredAdminAuth = {
      username: newUsername.trim() || storedAuth.username,
      salt: finalSalt,
      hash: finalHash,
      createdAt: storedAuth.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from('settings').upsert(
      {
        key: 'admin_auth',
        value: updatedAuth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      throw new Error(error.message || 'Failed to update credentials.');
    }

    // Update local session
    if (this.currentSession) {
      this.currentSession.username = updatedAuth.username;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));
    }
    if (this.currentUser) {
      this.currentUser.username = updatedAuth.username;
      this.currentUser.email = `${updatedAuth.username}@staffpay.app`;
      if (this.currentUser.user_metadata) {
        this.currentUser.user_metadata.username = updatedAuth.username;
      }
    }
  }

  /**
   * Logs out the Admin and terminates the local session
   */
  static async logout(): Promise<void> {
    this.currentUser = null;
    this.currentSession = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    this.notifyListeners('SIGNED_OUT', null);
  }

  /**
   * Returns current authenticated user
   */
  static getCurrentUser(): AdminUser | null {
    return this.currentUser;
  }

  /**
   * Returns current session
   */
  static getCurrentSession(): AdminSession | null {
    return this.currentSession;
  }

  /**
   * Returns true if Admin is logged in
   */
  static isAuthenticated(): boolean {
    return Boolean(this.currentUser || this.currentSession);
  }
}
