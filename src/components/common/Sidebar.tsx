import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Calendar,
  FileBarChart,
  HardDriveDownload,
  Settings,
  X,
  Building2,
  LogOut,
  Cloud,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLockApp?: () => void;
  hasPin?: boolean;
}

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
  { name: 'Salary & Payroll', path: '/salary', icon: CreditCard },
  { name: 'Holidays', path: '/holidays', icon: Calendar },
  { name: 'Reports', path: '/reports', icon: FileBarChart },
  { name: 'Backup & Export', path: '/backup', icon: HardDriveDownload },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onLockApp,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-slate-700 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-200 shadow-sm`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 bg-slate-50/80 border-b border-slate-200">
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className="flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-orange-300 shadow-sm shadow-blue-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                StaffPay
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
                  Cloud
                </span>
              </span>
              <span className="text-[11px] block text-slate-500 font-medium leading-none">
                Attendance & Payroll
              </span>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-orange-500' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          {onLockApp && (
            <button
              onClick={() => {
                onClose();
                onLockApp();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span>Sign Out (Admin)</span>
            </button>
          )}

          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 text-xs text-slate-800 font-bold mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-blue-700 flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                Supabase PostgreSQL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight font-medium">
              Real-time multi-device cloud database.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
