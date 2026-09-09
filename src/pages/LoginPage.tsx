import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  KeyRound,
  Building2,
  ShieldCheck,
  ArrowRight,
  User,
  UserPlus,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { AuthService } from '../services/authService';
import { AccountService } from '../services/accountService';
import { CloudSyncService } from '../services/cloudSyncService';
import { GoogleAuthService } from '../services/googleAuthService';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { FirebaseSyncService } from '../services/firebaseSyncService';
import { StaffPayAccount } from '../types/cloud';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');

  // Account form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [accountError, setAccountError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Active account & PIN states
  const [activeAccount, setActiveAccount] = useState<StaffPayAccount | null>(AccountService.getActiveAccount());
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPinSet, setIsPinSet] = useState<boolean | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    const checkState = async () => {
      const acc = AccountService.getActiveAccount();
      setActiveAccount(acc);

      const hasPin = await AuthService.isPinSet();
      setIsPinSet(hasPin);

      // If user is already authenticated with StaffPay account:
      if (acc) {
        if (!hasPin || AuthService.isSessionUnlocked()) {
          navigate('/dashboard', { replace: true });
        }
      }
    };

    checkState();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');
    setIsLoading(true);

    try {
      let account: StaffPayAccount;
      try {
        // First attempt Firebase Cloud Auth for cross-device login
        account = await FirebaseAuthService.login(username, password);
      } catch (cloudErr: any) {
        // If offline or local credentials exist, fallback to local authentication
        console.info('Firebase login fallback to local:', cloudErr?.message);
        account = await AccountService.authenticate(username, password);
      }

      setActiveAccount(account);

      // Initialize Firebase Cloud sync and background sync
      await FirebaseSyncService.initialize();
      await CloudSyncService.initialize();

      const hasPin = await AuthService.isPinSet();
      if (!hasPin || AuthService.isSessionUnlocked()) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setAccountError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');

    if (password !== confirmPassword) {
      setAccountError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setAccountError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      let account: StaffPayAccount;
      try {
        // Register in Firebase Cloud Auth
        account = await FirebaseAuthService.register(username, password, companyName);
      } catch (cloudErr: any) {
        console.warn('Firebase registration fallback to local:', cloudErr?.message);
        account = await AccountService.createAccount(username, password, companyName);
      }

      setActiveAccount(account);

      // Initialize real-time cloud sync for new account
      await FirebaseSyncService.initialize();
      await CloudSyncService.initialize();

      const hasPin = await AuthService.isPinSet();
      if (!hasPin || AuthService.isSessionUnlocked()) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setAccountError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await FirebaseAuthService.logout();
    await AccountService.logout();
    await AccountService.switchAccountClearCache();
    setActiveAccount(null);
    AuthService.lockSession();
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setAccountError('');
  };

  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    const isValid = await AuthService.verifyPin(pin);
    if (isValid) {
      navigate('/dashboard', { replace: true });
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }

    await AuthService.setPin(newPin);
    navigate('/dashboard', { replace: true });
  };

  const handleSkipPinSetup = () => {
    AuthService.setSessionUnlocked(true);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-orange-400 shadow-lg shadow-blue-600/20 ring-4 ring-orange-100 mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-blue-950 tracking-tight">StaffPay</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Employee Attendance, Leave & Salary Management
          </p>
        </div>

        {/* STEP 1: Not Logged in to StaffPay Account -> Username + Password Form */}
        {!activeAccount ? (
          <div className="space-y-5">
            {/* Tabs: Sign In / Create Account */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setAccountError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tab === 'signin'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setAccountError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {accountError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{accountError}</span>
              </div>
            )}

            {tab === 'signin' ? (
              /* Sign In Form */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username / Account ID
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin001"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <span>{isLoading ? 'Signing In...' : 'Sign In to StaffPay'}</span>
                  <ArrowRight className="w-4 h-4 text-orange-300" />
                </button>
              </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business / Company Name
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Global Solutions"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Choose Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin001"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span> (min. 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !username || !password || !confirmPassword}
                  className="w-full py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? 'Creating Account...' : 'Create StaffPay Account'}</span>
                </button>
              </form>
            )}

            {/* Cloud Sync Tagline */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                Firebase Real-Time Cloud Sync
              </span>
              <span className="text-emerald-600 font-semibold">Multi-Device Ready</span>
            </div>
          </div>
        ) : isPinSet ? (
          /* STEP 2A: StaffPay Account Authenticated -> Local PIN Unlock */
          <form onSubmit={handleUnlockPin} className="space-y-5">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 mb-4">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {activeAccount.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  Account: <b>{activeAccount.username}</b>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold mb-3 border border-orange-200">
                <Lock className="w-3.5 h-3.5 text-orange-600" />
                <span>Device Security PIN Lock</span>
              </div>
              <p className="text-sm text-slate-600 font-medium">
                Enter your Admin PIN to unlock StaffPay on this browser
              </p>
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-semibold">
                {pinError}
              </div>
            )}

            <div>
              <input
                type="password"
                maxLength={8}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center text-3xl tracking-[1em] py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!pin}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <span>Unlock StaffPay</span>
              <ArrowRight className="w-4 h-4 text-orange-300" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Log in with a different StaffPay account
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2B: Optional Local Device PIN Setup */
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 mb-4">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {activeAccount.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  Account: <b>{activeAccount.username}</b>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3 border border-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
                <span>Optional Device Lock</span>
              </div>
              <h2 className="text-lg font-bold text-blue-950">Setup Local Access PIN</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You can set an optional PIN lock for this browser, or proceed directly to your Dashboard.
              </p>
            </div>

            <form onSubmit={handleSetupPin} className="space-y-4">
              {pinError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-semibold">
                  {pinError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create 4-Digit Admin PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 4 digits"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Admin PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Confirm 4 digits"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!newPin}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Set PIN & Continue</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipPinSetup}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Continue without PIN (Open Access)
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
