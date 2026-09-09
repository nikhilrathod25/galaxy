import { GoogleUser } from '../types/cloud';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token: string;
              expires_in: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { message: string; type: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

const STORAGE_KEYS = {
  USER: 'staffpay_google_user',
  TOKEN: 'staffpay_google_token',
  TOKEN_EXPIRY: 'staffpay_google_token_expiry',
};

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

type AuthStateListener = (user: GoogleUser | null) => void;

export class GoogleAuthService {
  private static listeners: AuthStateListener[] = [];
  private static tokenClient: any = null;
  private static activeToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  /**
   * Returns whether a Google Client ID is configured
   */
  static isConfigured(): boolean {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    return Boolean(clientId && clientId.trim().length > 0);
  }

  /**
   * Gets the configured Google Client ID
   */
  static getClientId(): string {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  }

  /**
   * Checks if user is authenticated with Google
   */
  static isAuthenticated(): boolean {
    return Boolean(this.getCurrentUser());
  }

  /**
   * Initializes or gets the cached Google User
   */
  static getCurrentUser(): GoogleUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading stored Google User:', e);
    }
    return null;
  }

  /**
   * Gets the active valid access token if available
   */
  static getAccessToken(): string | null {
    if (this.activeToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.activeToken;
    }

    try {
      const savedToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedExpiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      if (savedToken && savedExpiry) {
        const expiry = parseInt(savedExpiry, 10);
        if (Date.now() < expiry - 60000) {
          this.activeToken = savedToken;
          this.tokenExpiresAt = expiry;
          return savedToken;
        }
      }
    } catch (e) {
      console.error('Error reading cached access token:', e);
    }

    return null;
  }

  /**
   * Initializes Google Identity Services (GIS) Token Client
   */
  private static initTokenClient(): Promise<any> {
    return new Promise((resolve, reject) => {
      const clientId = this.getClientId();
      if (!clientId) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured in .env'));
        return;
      }

      if (!window.google?.accounts?.oauth2) {
        // Wait up to 5 seconds for script to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkInterval);
            this.setupClient(clientId, resolve, reject);
          } else if (attempts > 25) {
            clearInterval(checkInterval);
            reject(
              new Error(
                'Google Identity Services failed to load. Please check your internet connection.'
              )
            );
          }
        }, 200);
        return;
      }

      this.setupClient(clientId, resolve, reject);
    });
  }

  private static setupClient(
    clientId: string,
    resolve: (client: any) => void,
    reject: (err: any) => void
  ) {
    try {
      this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: () => {}, // Dynamically assigned per request
        error_callback: (err) => {
          console.error('GIS Error:', err);
        },
      });
      resolve(this.tokenClient);
    } catch (err) {
      reject(err);
    }
  }

  /**
   * Prompts the user to log in with Google and requests Drive authorization
   */
  static async signIn(): Promise<GoogleUser> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file.'
      );
    }

    const client = await this.initTokenClient();

    return new Promise<GoogleUser>((resolve, reject) => {
      client.callback = async (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        try {
          const token = response.access_token;
          const expiresIn = response.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          this.activeToken = token;
          this.tokenExpiresAt = expiresAt;

          sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
          sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiresAt));

          // Fetch user profile from Google UserInfo endpoint
          const user = await this.fetchUserProfile(token);

          // Save user info
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          this.notifyListeners(user);

          resolve(user);
        } catch (err) {
          reject(err);
        }
      };

      // Prompt token request popup
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }

  // Alias for signIn
  static async login(): Promise<GoogleUser> {
    return this.signIn();
  }

  /**
   * Mock login for demo / evaluation without requiring Client ID in development
   */
  static async mockLogin(email = 'admin@staffpay.app', name = 'StaffPay Admin'): Promise<GoogleUser> {
    const user: GoogleUser = {
      id: 'mock_google_id_' + Date.now(),
      email,
      name,
    };
    const expiresAt = Date.now() + 3600 * 1000 * 24;
    this.activeToken = 'mock_access_token';
    this.tokenExpiresAt = expiresAt;

    sessionStorage.setItem(STORAGE_KEYS.TOKEN, this.activeToken);
    sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiresAt));
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    this.notifyListeners(user);
    return user;
  }

  /**
   * Silently refreshes access token if user is already logged in
   */
  static async ensureValidToken(): Promise<string> {
    const existing = this.getAccessToken();
    if (existing) return existing;

    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user is currently authenticated with Google.');
    }

    if (!this.isConfigured()) {
      // Mock mode fallback
      return 'mock_access_token';
    }

    // Request new token
    const client = await this.initTokenClient();
    return new Promise<string>((resolve, reject) => {
      client.callback = (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const token = response.access_token;
        const expiresIn = response.expires_in || 3600;
        const expiresAt = Date.now() + expiresIn * 1000;

        this.activeToken = token;
        this.tokenExpiresAt = expiresAt;
        sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
        sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiresAt));

        resolve(token);
      };

      client.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Fetches Google user profile from Google OAuth API
   */
  private static async fetchUserProfile(token: string): Promise<GoogleUser> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Google profile (${res.status} ${res.statusText})`);
    }

    const data = await res.json();
    return {
      id: data.sub,
      email: data.email,
      name: data.name || data.email,
      picture: data.picture,
      givenName: data.given_name,
      familyName: data.family_name,
    };
  }

  /**
   * Signs out the current Google user and clears all cached tokens
   */
  static async signOut(): Promise<void> {
    const token = this.getAccessToken();
    if (token && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {
        console.warn('Token revocation skipped:', e);
      }
    }

    this.activeToken = null;
    this.tokenExpiresAt = 0;
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.USER);

    this.notifyListeners(null);
  }

  // Alias for signOut
  static async logout(): Promise<void> {
    return this.signOut();
  }

  /**
   * Auth state change listener subscription
   */
  static onAuthStateChanged(listener: AuthStateListener): () => void {
    this.listeners.push(listener);
    listener(this.getCurrentUser());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Alias for onAuthStateChanged
  static subscribe(listener: AuthStateListener): () => void {
    return this.onAuthStateChanged(listener);
  }

  private static notifyListeners(user: GoogleUser | null): void {
    this.listeners.forEach((l) => l(user));
  }
}
