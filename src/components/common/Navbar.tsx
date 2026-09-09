import React, { useState, useEffect } from 'react';
import { Menu, ShieldAlert, Download, Clock, ShieldCheck, Lock, Settings, LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SettingsRepository } from '../../repositories/settingsRepository';
import { AccountService } from '../../services/accountService';
import { SyncStatusIndicator } from '../cloud/SyncStatusIndicator';
import { formatDisplayDate } from '../../utils/dateUtils';
import { CompanySettings } from '../../types';
import { StaffPayAccount } from '../../types/cloud';

interface NavbarProps {
  onOpenSidebar: () => void;
  onLockApp?: () => void;
  hasPin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSidebar,
  onLockApp,
  hasPin,
}) => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeAccount, setActiveAccount] = useState<StaffPayAccount | null>(AccountService.getActiveAccount());

  useEffect(() => {
    const loadInfo = async () => {
      const c = await SettingsRepository.getCompanySettings();
      setCompany(c);
      const meta = await SettingsRepository.getBackupMeta();
      setLastBackupAt(meta.lastBackupAt);
      setActiveAccount(AccountService.getActiveAccount());
    };
    loadInfo();

    // Clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Do you want to log out of your StaffPay account?')) {
      await AccountService.logout();
      navigate('/login');
    }
  };

  // Compute days since last backup
  const getBackupStatus = () => {
    if (!lastBackupAt) {
      return {
        isOverdue: true,
        label: 'No Backup Yet',
        color: 'text-orange-700 bg-orange-50 border-orange-200',
      };
    }
    const backupDate = new Date(lastBackupAt).getTime();
    const now = Date.now();
    const daysDiff = (now - backupDate) / (1000 * 3600 * 24);

    if (daysDiff > 7) {
      return {
        isOverdue: true,
        label: 'Backup Overdue',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
      };
    }
    return {
      isOverdue: false,
      label: `Backed up: ${formatDisplayDate(lastBackupAt, 'dd MMM')}`,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    };
  };

  const backupStatus = getBackupStatus();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{company?.companyName || 'StaffPay'}</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            {formatDisplayDate(new Date().toISOString(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-semibold border border-slate-200/60">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>{currentTime}</span>
        </div>

        {/* Google Drive Central Sync Status Indicator */}
        <SyncStatusIndicator />

        {/* Backup Status Pill */}
        <Link
          to="/backup"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all hover:shadow-sm ${backupStatus.color}`}
          title="Click to manage database backup & restore"
        >
          {backupStatus.isOverdue ? (
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          )}
          <span className="hidden md:inline">{backupStatus.label}</span>
          <span className="md:hidden">Backup</span>
        </Link>

        {/* Quick Export Button in Orange */}
        <Link
          to="/backup"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all shadow-sm shadow-orange-500/20 active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Link>

        {/* Settings button in Header Menu */}
        <Link
          to="/settings"
          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          title="Company & App Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Lock PIN button */}
        {hasPin && onLockApp && (
          <button
            onClick={onLockApp}
            className="p-2 rounded-xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
            title="Lock application"
            aria-label="Lock application"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}

        {/* StaffPay Account Badge & Logout */}
        {activeAccount && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80"
              title={`StaffPay Account: ${activeAccount.username} (${activeAccount.accountId})`}
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[100px] truncate">{activeAccount.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Log Out of StaffPay Account"
              aria-label="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
