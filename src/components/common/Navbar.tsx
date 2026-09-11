import React, { useState, useEffect } from 'react';
import { Clock, LogOut, User, FileSpreadsheet, Building2, Calculator as CalcIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SettingsRepository } from '../../repositories/settingsRepository';
import { AuthService } from '../../services/authService';
import { CompanySettings } from '../../types';
import { CsvImportExportModal } from './CsvImportExportModal';
import { CalculatorModal } from './CalculatorModal';

interface NavbarProps {
  onOpenSidebar?: () => void;
  onLockApp?: () => void;
  hasPin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

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

    // Clock in IST
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
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
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        {/* Left: Brand Logo Icon Only */}
        <div className="flex items-center gap-3 shrink-0">
          {company?.logoUrl ? (
            <img
              src={company.logoUrl}
              alt="Logo"
              className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-orange-300 shadow-md shadow-blue-600/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live IST Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-semibold border border-slate-200/60">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>{currentTime} IST</span>
          </div>

          {/* Quick Calculator Header Button */}
          <button
            type="button"
            onClick={() => setIsCalcModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
            title="Open Quick Calculator"
          >
            <CalcIcon className="w-4 h-4 text-orange-600" />
            <span className="hidden xs:inline">Calculator</span>
          </button>

          {/* CSV Import/Export Header Button */}
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
            title="Import or Export CSV Data"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span className="hidden xs:inline">Import / Export (CSV)</span>
            <span className="xs:hidden">CSV</span>
          </button>

          {/* Admin Account Badge & Logout */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200/80"
              title="Authenticated Admin"
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[80px] sm:max-w-[120px] truncate">{adminEmail || 'Admin'}</span>
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

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
      />

      {/* CSV Import/Export Modal */}
      <CsvImportExportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />
    </>
  );
};
