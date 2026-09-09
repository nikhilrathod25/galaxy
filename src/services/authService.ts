import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
}

export class AuthService {
  private static currentUser: User | null = null;
  private static currentSession: Session | null = null;
  private static isInitialized = false;

  /**
   * Transforms username into a secure internal Supabase Auth email identity
   */
  static normalizeUsernameToEmail(username: string): string {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    return `${clean}@staffpay.internal`;
  }

  /**
   * Initializes authentication state from Supabase session
   */
  static async initialize(): Promise<User | null> {
    if (this.isInitialized && this.currentUser) {
      return this.currentUser;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.user) {
        this.currentSession = data.session;
        this.currentUser = data.session.user;
      } else {
        this.currentSession = null;
        this.currentUser = null;
      }
    } catch (e) {
      console.warn('Auth initialization notice:', e);
      this.currentSession = null;
      this.currentUser = null;
    }

    this.isInitialized = true;
    return this.currentUser;
  }

  /**
   * Subscribes to Supabase Auth state changes
   */
  static onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange((event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user || null;
      callback(event, session);
    });
  }

  /**
   * Logs in the Admin with username and password.
   * If the Admin account does not exist in Supabase yet, automatically registers it.
   */
  static async login(usernameInput: string, passwordInput: string): Promise<AdminUser> {
    const username = usernameInput.trim().toLowerCase();
    if (!username || !passwordInput) {
      throw new Error('Please enter both username and password.');
    }
    if (passwordInput.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const email = this.normalizeUsernameToEmail(username);

    // 1. Attempt Sign In
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: passwordInput,
    });

    if (!signInError && signInData?.user) {
      this.currentUser = signInData.user;
      this.currentSession = signInData.session;
      return {
        id: signInData.user.id,
        username,
        email,
      };
    }

    // 2. If user not found / invalid credentials on first attempt, try auto sign-up
    if (
      signInError &&
      (signInError.message.toLowerCase().includes('invalid login credentials') ||
        signInError.message.toLowerCase().includes('user not found'))
    ) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: passwordInput,
        options: {
          data: {
            username,
            role: 'admin',
          },
        },
      });

      if (!signUpError && signUpData?.user) {
        // If Supabase auto-confirms or returns session
        if (signUpData.session) {
          this.currentUser = signUpData.user;
          this.currentSession = signUpData.session;
          return {
            id: signUpData.user.id,
            username,
            email,
          };
        }

        // Try immediate login after signup
        const retry = await supabase.auth.signInWithPassword({
          email,
          password: passwordInput,
        });

        if (!retry.error && retry.data?.user) {
          this.currentUser = retry.data.user;
          this.currentSession = retry.data.session;
          return {
            id: retry.data.user.id,
            username,
            email,
          };
        }
      }

      // If signup also failed with "User already registered", it was an incorrect password
      if (signUpError && signUpError.message.toLowerCase().includes('already registered')) {
        throw new Error('Incorrect password. Please try again.');
      }
    }

    throw new Error(signInError?.message || 'Authentication failed. Please check credentials.');
  }

  /**
   * Logs out the Admin and terminates the Supabase Auth session
   */
  static async logout(): Promise<void> {
    this.currentUser = null;
    this.currentSession = null;
    await supabase.auth.signOut();
  }

  /**
   * Returns current authenticated user
   */
  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Returns current session
   */
  static getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Returns true if Admin is logged in
   */
  static isAuthenticated(): boolean {
    return Boolean(this.currentUser || this.currentSession);
  }
}
