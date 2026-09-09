import React from 'react';
import { AttendanceStatus } from '../../types';
import { Check, X, Clock, Palmtree, AlertCircle, RotateCcw } from 'lucide-react';

interface AttendanceStatusSelectorProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'full' | 'compact';
}

interface StatusConfig {
  value: AttendanceStatus;
  label: string;
  subLabel: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  idleBg: string;
  idleBorder: string;
  idleText: string;
}

const statusConfigs: StatusConfig[] = [
  {
    value: 'Present',
    label: 'Present',
    subLabel: 'Full Pay',
    shortLabel: 'P',
    icon: Check,
    activeBg: 'bg-blue-600',
    activeBorder: 'border-blue-700',
    activeText: 'text-white',
    idleBg: 'bg-white hover:bg-blue-50',
    idleBorder: 'border-slate-200 hover:border-blue-300',
    idleText: 'text-slate-700 hover:text-blue-700',
  },
  {
    value: 'Absent',
    label: 'Absent',
    subLabel: '₹0 Pay',
    shortLabel: 'A',
    icon: X,
    activeBg: 'bg-rose-600',
    activeBorder: 'border-rose-700',
    activeText: 'text-white',
    idleBg: 'bg-white hover:bg-rose-50',
    idleBorder: 'border-slate-200 hover:border-rose-300',
    idleText: 'text-slate-700 hover:text-rose-700',
  },
  {
    value: 'Half Day',
    label: 'Half Day',
    subLabel: '50% Pay',
    shortLabel: 'HD',
    icon: Clock,
    activeBg: 'bg-orange-500',
    activeBorder: 'border-orange-600',
    activeText: 'text-white',
    idleBg: 'bg-white hover:bg-orange-50',
    idleBorder: 'border-slate-200 hover:border-orange-300',
    idleText: 'text-slate-700 hover:text-orange-700',
  },
  {
    value: 'Paid Leave',
    label: 'Paid Leave',
    subLabel: 'Full Pay',
    shortLabel: 'PL',
    icon: Palmtree,
    activeBg: 'bg-sky-600',
    activeBorder: 'border-sky-700',
    activeText: 'text-white',
    idleBg: 'bg-white hover:bg-sky-50',
    idleBorder: 'border-slate-200 hover:border-sky-300',
    idleText: 'text-slate-700 hover:text-sky-700',
  },
  {
    value: 'Unpaid Leave',
    label: 'Unpaid Leave',
    subLabel: '₹0 Pay',
    shortLabel: 'UL',
    icon: AlertCircle,
    activeBg: 'bg-amber-600',
    activeBorder: 'border-amber-700',
    activeText: 'text-white',
    idleBg: 'bg-white hover:bg-amber-50',
    idleBorder: 'border-slate-200 hover:border-amber-300',
    idleText: 'text-slate-700 hover:text-amber-700',
  },
];

export const AttendanceStatusSelector: React.FC<AttendanceStatusSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'md',
  mode = 'full',
}) => {
  if (mode === 'compact') {
    return (
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
        {statusConfigs.map(item => {
          const isSelected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.value)}
              title={`${item.label} (${item.subLabel})`}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                isSelected
                  ? `${item.activeBg} ${item.activeText} shadow-sm`
                  : `${item.idleBg} ${item.idleText}`
              } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
        {value !== 'Not Marked' && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('Not Marked')}
            title="Reset / Clear Attendance"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Full user-friendly button row
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {statusConfigs.map(item => {
        const isSelected = value === item.value;
        const Icon = item.icon;

        return (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold border transition-all duration-150 ${
              isSelected
                ? `${item.activeBg} ${item.activeBorder} ${item.activeText} shadow-md ring-2 ring-offset-1 ring-blue-500/20 scale-[1.02]`
                : `${item.idleBg} ${item.idleBorder} ${item.idleText} shadow-xs`
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
          >
            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : ''}`} />
            <span>{item.label}</span>
          </button>
        );
      })}

      {value !== 'Not Marked' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('Not Marked')}
          title="Reset to Not Marked"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Clear</span>
        </button>
      )}
    </div>
  );
};
