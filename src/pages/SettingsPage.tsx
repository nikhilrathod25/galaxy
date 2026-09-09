import React, { useState, useEffect } from 'react';
import {
  Building2,
  SlidersHorizontal,
  Save,
  CheckCircle2,
  Cloud,
  LogOut,
  User,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SettingsRepository } from '../repositories/settingsRepository';
import { AuthService } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CompanySettings, SalarySettings } from '../types';

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

  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const c = await SettingsRepository.getCompanySettings();
      setCompany(c);

      const s = await SettingsRepository.getSalarySettings();
      setSalarySettings(s);

      const user = AuthService.getCurrentUser();
      if (user) {
        setAdminUsername(user.user_metadata?.username || user.email?.split('@')[0] || 'admin');
        setAdminEmail(user.email || 'admin@staffpay.internal');
      }
    };
    loadSettings();
  }, []);

  const handleLogoutAccount = async () => {
    await AuthService.logout();
    setLogoutConfirmOpen(false);
    navigate('/login');
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      await SettingsRepository.saveCompanySettings(company);
      await SettingsRepository.saveSalarySettings(salarySettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings to cloud.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings & Cloud Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your business profile, salary calculation rules, and Supabase cloud connection.
        </p>
      </div>

      {/* Save Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>All company settings saved successfully to Supabase PostgreSQL cloud!</span>
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <span>{saveError}</span>
        </div>
      )}

      {/* 1. Supabase Cloud & Admin Account Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Supabase Cloud Database</h2>
              <p className="text-xs text-slate-500">Centralized single-admin cloud persistence & real-time sync</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Admin Username</span>
            </div>
            <div className="text-sm font-bold text-slate-900">{adminUsername || 'admin'}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Database Engine</span>
            </div>
            <div className="text-sm font-bold text-slate-900">PostgreSQL (Row Level Security Active)</div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Admin Account</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* 2. Company Information */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Business & Organization Profile</h2>
              <p className="text-xs text-slate-500">Details printed on salary slips and official reports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Company / Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={company.companyName}
                onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={company.tagline || ''}
                onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={company.phone || ''}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Business Email</label>
              <input
                type="email"
                value={company.email || ''}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Authorized Signatory Name</label>
              <input
                type="text"
                value={company.authorizedSignatory || ''}
                onChange={(e) => setCompany({ ...company, authorizedSignatory: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Office / Business Address</label>
              <textarea
                rows={2}
                value={company.address || ''}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* 3. Salary & Attendance Calculation Rules */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Salary Calculation Rules</h2>
              <p className="text-xs text-slate-500">Configure default payroll divisor and working day logic</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Default Calculation Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    salarySettings.defaultCalculationMode === 'working_days'
                      ? 'bg-blue-50/60 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="calcMode"
                    value="working_days"
                    checked={salarySettings.defaultCalculationMode === 'working_days'}
                    onChange={() =>
                      setSalarySettings({ ...salarySettings, defaultCalculationMode: 'working_days' })
                    }
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">Working Days Mode (Recommended)</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Daily Salary = Base / (Total calendar days minus non-working days)
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    salarySettings.defaultCalculationMode === 'calendar_days'
                      ? 'bg-blue-50/60 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="calcMode"
                    value="calendar_days"
                    checked={salarySettings.defaultCalculationMode === 'calendar_days'}
                    onChange={() =>
                      setSalarySettings({ ...salarySettings, defaultCalculationMode: 'calendar_days' })
                    }
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">Calendar Days Mode</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Daily Salary = Base / Total days in the month (28, 30, or 31)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={salarySettings.excludeSundays}
                  onChange={(e) => setSalarySettings({ ...salarySettings, excludeSundays: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">
                  Treat Sundays as Paid Weekly Offs (Excluded from deductions)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={salarySettings.excludeHolidays}
                  onChange={(e) => setSalarySettings({ ...salarySettings, excludeHolidays: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">
                  Treat Public Holidays as Paid Holidays (Excluded from deductions)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving to Cloud...' : 'Save Settings to Supabase'}</span>
          </button>
        </div>
      </form>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Sign Out of StaffPay Admin?"
        message="Your data remains safely stored in the Supabase PostgreSQL cloud database. You can sign back in from any device anytime."
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={handleLogoutAccount}
        onClose={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
};
