import React, { useState, useEffect } from 'react';
import {
  Building2,
  Lock,
  SlidersHorizontal,
  Save,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Database,
  Cloud,
  RefreshCw,
  LogOut,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SettingsRepository } from '../repositories/settingsRepository';
import { AuthService } from '../services/authService';
import { AccountService } from '../services/accountService';
import { CloudSyncService } from '../services/cloudSyncService';
import { seedSampleData } from '../db/seed';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CompanySettings, SalarySettings, AppPreferences, AuthSettings } from '../types';
import { StaffPayAccount, SyncState } from '../types/cloud';
import { formatDisplayDate } from '../utils/dateUtils';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySettings>({
    companyName: 'My Business',
    tagline: 'Employee Attendance & Salary Management',
    address: '',
    phone: '',
    email: '',
    authorizedSignatory: 'Authorized Signatory',
  });

  const [salarySettings, setSalarySettings] = useState<SalarySettings>({
    defaultCalculationMode: 'working_days',
    workingDaysPerWeek: 6,
    excludeSundays: true,
    excludeHolidays: true,
  });

  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    pinEnabled: false,
    pinHash: '',
  });

  // Account & Cloud Sync state
  const [activeAccount, setActiveAccount] = useState<StaffPayAccount | null>(AccountService.getActiveAccount());
  const [syncState, setSyncState] = useState<SyncState>(CloudSyncService.getSyncState());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // PIN change state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const c = await SettingsRepository.getCompanySettings();
      setCompany(c);

      const s = await SettingsRepository.getSalarySettings();
      setSalarySettings(s);

      const a = await SettingsRepository.getAuthSettings();
      setAuthSettings(a);

      setActiveAccount(AccountService.getActiveAccount());
    };
    loadSettings();

    const unsubSync = CloudSyncService.subscribe((state) => {
      setSyncState({ ...state });
      setActiveAccount(AccountService.getActiveAccount());
    });

    return () => {
      unsubSync();
    };
  }, []);

  const handleManualCloudSync = async () => {
    setIsManualSyncing(true);
    try {
      await CloudSyncService.sync();
    } catch (err: any) {
      alert(`Cloud sync failed: ${err.message}`);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleLogoutAccount = async () => {
    await AccountService.logout();
    setLogoutConfirmOpen(false);
    navigate('/login');
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await SettingsRepository.saveCompanySettings(company);
      await SettingsRepository.saveSalarySettings(salarySettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }

    await AuthService.setPin(newPin);
    const updated = await SettingsRepository.getAuthSettings();
    setAuthSettings(updated);
    setNewPin('');
    setConfirmPin('');
    setPinSuccess('Admin PIN updated successfully!');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  const handleDisablePin = async () => {
    await AuthService.disablePin();
    const updated = await SettingsRepository.getAuthSettings();
    setAuthSettings(updated);
    setPinSuccess('PIN security disabled.');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  const handleLoadSampleData = async () => {
    setIsSeeding(true);
    setSeedMessage('');
    try {
      const res = await seedSampleData();
      setSeedMessage(`Successfully loaded ${res.employeesCount} sample employees and ${res.attendanceCount} attendance logs!`);
    } catch (err: any) {
      setSeedMessage(err.message || 'Failed to load sample data.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Configure StaffPay cloud sync, company profile, default payroll rules, and access PIN
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* StaffPay Account & Cloud Sync Section */}
      <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 sm:p-8 space-y-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Google Drive Central Cloud Sync</h3>
              <p className="text-xs text-slate-400 font-medium">
                Centralized master database storage across all your browsers and devices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeAccount ? (
              <>
                <button
                  type="button"
                  onClick={handleManualCloudSync}
                  disabled={isManualSyncing || syncState.status === 'syncing'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{isManualSyncing || syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">StaffPay Account:</span>
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              <strong className="text-slate-800 font-bold">{activeAccount?.username || 'Guest'}</strong>
            </div>
            {activeAccount?.accountId && (
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{activeAccount.accountId}</span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">Sync Status:</span>
            <span className="font-bold text-slate-800 capitalize flex items-center gap-1.5">
              {syncState.status === 'synced' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>}
              {syncState.status === 'syncing' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-spin"></span>}
              {syncState.status === 'offline' && <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>}
              {syncState.status === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>}
              {syncState.status}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">Last Synced:</span>
            <span className="font-bold text-slate-800">
              {syncState.lastSyncAt
                ? formatDisplayDate(syncState.lastSyncAt, 'dd MMM yyyy, hh:mm a')
                : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Company Information Form */}
      <form onSubmit={handleSaveCompany} className="space-y-6 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Company / Organization Profile</h3>
              <p className="text-xs text-slate-400 font-medium">
                Printed in the header of generated PDF salary slips and CSV reports
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={company.companyName}
                onChange={e => setCompany({ ...company, companyName: e.target.value })}
                placeholder="e.g. Apex Global Solutions"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={company.tagline || ''}
                onChange={e => setCompany({ ...company, tagline: e.target.value })}
                placeholder="e.g. Employee Attendance & Salary Management"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Official Phone
              </label>
              <input
                type="tel"
                value={company.phone}
                onChange={e => setCompany({ ...company, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Official Email
              </label>
              <input
                type="email"
                value={company.email}
                onChange={e => setCompany({ ...company, email: e.target.value })}
                placeholder="e.g. admin@company.com"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Office Address
              </label>
              <input
                type="text"
                value={company.address}
                onChange={e => setCompany({ ...company, address: e.target.value })}
                placeholder="e.g. Suite 402, Business Center, MG Road"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Authorized Signatory Title
              </label>
              <input
                type="text"
                value={company.authorizedSignatory || ''}
                onChange={e => setCompany({ ...company, authorizedSignatory: e.target.value })}
                placeholder="e.g. Director / HR Manager"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Salary Engine Defaults */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Salary Calculation Rules</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Select baseline calculation rules for monthly payroll deductions
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Default Calculation Mode
                </label>
                <select
                  value={salarySettings.defaultCalculationMode}
                  onChange={e =>
                    setSalarySettings({
                      ...salarySettings,
                      defaultCalculationMode: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="working_days">
                    Working Days Mode (Monday–Saturday minus Holidays)
                  </option>
                  <option value="calendar_days">
                    Calendar Days Mode (Total Days in Month)
                  </option>
                </select>
              </div>

              <div className="flex flex-col justify-center space-y-2 pt-2 md:pt-0">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={salarySettings.excludeSundays}
                    onChange={e =>
                      setSalarySettings({ ...salarySettings, excludeSundays: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Exclude Sundays from Working Days</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={salarySettings.excludeHolidays}
                    onChange={e =>
                      setSalarySettings({ ...salarySettings, excludeHolidays: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Exclude Configured Holidays from Working Days</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-orange-300" />
              <span>{isSaving ? 'Saving Settings...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Security & Admin PIN Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 w-full">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Client-Side PIN Security</h3>
            <p className="text-xs text-slate-400 font-medium">
              Optional UI access lock for shared laptops and office devices
            </p>
          </div>
        </div>

        {pinError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {pinError}
          </div>
        )}

        {pinSuccess && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{pinSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePin} className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Status: {authSettings.pinEnabled ? 'PIN Lock Enabled' : 'Open Access (No PIN)'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {authSettings.pinEnabled
                  ? 'App requires PIN to unlock when opened'
                  : 'Anyone on this browser can open StaffPay'}
              </span>
            </div>

            {authSettings.pinEnabled && (
              <button
                type="button"
                onClick={handleDisablePin}
                className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Disable PIN
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {authSettings.pinEnabled ? 'Change PIN (New PIN)' : 'Set 4-Digit Admin PIN'}
              </label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Confirm PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newPin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-sm shadow-orange-500/20 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{authSettings.pinEnabled ? 'Update PIN' : 'Activate PIN Lock'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Demo / Sample Data Generator for testing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Sample Evaluation Data</h3>
            <p className="text-xs text-slate-400 font-medium">
              Optionally populate realistic test employees and September attendance to verify salary formulas
            </p>
          </div>
        </div>

        {seedMessage && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
            {seedMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 max-w-md font-medium">
            Loads 5 sample employees (including Rahul, Priya, Amit Verma) with September 1–10 attendance.
          </p>
          <button
            type="button"
            disabled={isSeeding}
            onClick={handleLoadSampleData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold transition-colors border border-orange-200 self-end sm:self-auto cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>{isSeeding ? 'Loading...' : 'Load Sample Data'}</span>
          </button>
        </div>
      </div>

      {/* Log Out Account Confirmation Modal */}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogoutAccount}
        title="Log Out of StaffPay Account"
        message="Logging out will safely close this account session on this device. Your data remains safely stored in Google Drive."
        confirmLabel="Yes, Log Out"
        variant="warning"
      />
    </div>
  );
};
