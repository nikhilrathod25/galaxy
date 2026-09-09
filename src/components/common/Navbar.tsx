import React, { useState, useEffect } from 'react';
import { Menu, Clock, Settings, LogOut, User, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SettingsRepository } from '../../repositories/settingsRepository';
import { AuthService } from '../../services/authService';
import { formatDisplayDate } from '../../utils/dateUtils';
import { CompanySettings } from '../../types';

interface NavbarProps {
  onOpenSidebar: () => void;
  onLockApp?: () => void;
  hasPin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSidebar,
}) => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');

  useEffect(() => {
    const loadInfo = async () => {
      const c = await SettingsRepository.getCompanySettings();
      setCompany(c);
      const user = AuthService.getCurrentUser();
      if (user) {
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Admin';
        setAdminEmail(username);
      }
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
    if (window.confirm('Do you want to log out of StaffPay?')) {
      await AuthService.logout();
      navigate('/login');
    }
  };

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
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Online Cloud
            </span>
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

        {/* Settings Button */}
        <Link
          to="/settings"
          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          title="Company & App Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Admin Account Badge & Logout */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200/80"
            title="Authenticated Admin"
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="max-w-[120px] truncate">{adminEmail || 'Admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Log Out of StaffPay"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
