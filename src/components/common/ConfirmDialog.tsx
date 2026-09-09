import React from 'react';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  isLoading = false,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: AlertCircle,
          iconBg: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/50',
          btnBg: 'bg-rose-600 hover:bg-rose-700 text-white',
        };
      case 'info':
        return {
          icon: Info,
          iconBg: 'bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50',
          btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
      case 'warning':
      default:
        return {
          icon: AlertTriangle,
          iconBg: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/50',
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
    }
  };

  const { icon: Icon, iconBg, btnBg } = getVariantStyles();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconBg}`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              onConfirm();
            }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 ${btnBg}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
