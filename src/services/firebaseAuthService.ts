import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { AccountService } from './accountService';
import { StaffPayAccount } from '../types/cloud';

export class FirebaseAuthService {
  /**
   * Helper to normalize username or email into an email for Firebase Auth
   */
  static normalizeEmail(input: string): string {
    const trimmed = input.trim().toLowerCase();
    if (trimmed.includes('@')) {
      return trimmed;
    }
    // Convert plain username (e.g. 'admin001') to a valid email format
    return `${trimmed}@staffpay.app`;
  }

  /**
   * Register a new user on Firebase Auth and create cloud account record
   */
  static async register(
    usernameOrEmail: string,
    password: string,
    companyName?: string
  ): Promise<StaffPayAccount> {
    const email = this.normalizeEmail(usernameOrEmail);
    const username = usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail.trim().toLowerCase();

    // 1. Create user in Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    const now = new Date().toISOString();

    const account: StaffPayAccount = {
      accountId: uid,
      username,
      companyName: companyName?.trim() || 'StaffPay Business',
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };

    // 2. Save account profile to Firestore
    try {
      const accountRef = doc(firestore, 'accounts', uid);
      await setDoc(accountRef, {
        accountId: uid,
        username,
        email,
        companyName: account.companyName,
        createdAt: now,
        updatedAt: now,
        status: 'active',
      });
    } catch (e) {
      console.warn('Firestore account profile write warning:', e);
    }

    // 3. Register locally in AccountService
    const localAccounts = AccountService.getAccounts();
    const existingIndex = localAccounts.findIndex((a) => a.accountId === uid || a.username === username);
    if (existingIndex >= 0) {
      localAccounts[existingIndex] = account;
    } else {
      localAccounts.push(account);
    }
    localStorage.setItem('staffpay_registered_accounts', JSON.stringify(localAccounts));
    AccountService.setActiveAccount(account);

    return account;
  }

  /**
   * Sign In with Firebase Auth and retrieve cloud account record across any device
   */
  static async login(
    usernameOrEmail: string,
    password: string
  ): Promise<StaffPayAccount> {
    const email = this.normalizeEmail(usernameOrEmail);
    const username = usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail.trim().toLowerCase();

    // 1. Authenticate with Firebase Auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    const now = new Date().toISOString();

    // 2. Fetch account metadata from Firestore
    let companyName = 'StaffPay Business';
    try {
      const accountRef = doc(firestore, 'accounts', uid);
      const snap = await getDoc(accountRef);
      if (snap.exists()) {
        const data = snap.data();
        companyName = data.companyName || companyName;
      } else {
        // Create initial account profile if missing
        await setDoc(accountRef, {
          accountId: uid,
          username,
          email,
          companyName,
          createdAt: now,
          updatedAt: now,
          status: 'active',
        });
      }
    } catch (e) {
      console.warn('Could not fetch Firestore account profile:', e);
    }

    const account: StaffPayAccount = {
      accountId: uid,
      username,
      companyName,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };

    // 3. Cache account locally
    const localAccounts = AccountService.getAccounts();
    const existingIndex = localAccounts.findIndex((a) => a.accountId === uid || a.username === username);
    if (existingIndex >= 0) {
      localAccounts[existingIndex] = account;
    } else {
      localAccounts.push(account);
    }
    localStorage.setItem('staffpay_registered_accounts', JSON.stringify(localAccounts));
    AccountService.setActiveAccount(account);

    return account;
  }

  /**
   * Log out of Firebase and local session
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signout error:', e);
    }
    await AccountService.logout();
  }

  /**
   * Subscribe to Firebase Auth state
   */
  static onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Get current authenticated user
   */
  static getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  }
}
