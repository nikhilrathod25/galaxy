import React, { useState } from 'react';
import {
  FileCheck,
  AlertTriangle,
  Layers,
  RefreshCw,
  Calendar,
  Users,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { BackupValidationResult, ImportMode, BackupData } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';

interface BackupPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: BackupValidationResult | null;
  backupData: BackupData | null;
  onConfirmImport: (mode: ImportMode) => Promise<void>;
}

export const BackupPreviewModal: React.FC<BackupPreviewModalProps> = ({
  isOpen,
  onClose,
  validation,
  backupData,
  onConfirmImport,
}) => {
  const [selectedMode, setSelectedMode] = useState<ImportMode>('merge');
  const [isImporting, setIsImporting] = useState(false);

  if (!validation || !validation.summary || !backupData) return null;

  const summary = validation.summary;

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onConfirmImport(selectedMode);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Backup Verification & Import Preview"
      subtitle="Verify backup payload before writing to IndexedDB"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Verification Success Box in Blue */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900">
          <FileCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Backup Verified:</span> Schema Version{' '}
            {summary.backupVersion} (Exported on{' '}
            {formatDisplayDate(summary.exportedAt, 'dd MMM yyyy, hh:mm a')})
          </div>
        </div>

        {/* Counts Grid in Blue & Orange */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.employeeCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Employees</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.attendanceCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Attendance Logs</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.salaryRecordCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Salary Records</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.holidayCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Holidays</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.leaveTypeCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Leave Types</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                {summary.leaveCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Leaves</div>
            </div>
          </div>
        </div>

        {/* Import Mode Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Choose Import Mode:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Merge Option (Default) */}
            <div
              onClick={() => setSelectedMode('merge')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMode === 'merge'
                  ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="radio"
                  name="importMode"
                  checked={selectedMode === 'merge'}
                  onChange={() => setSelectedMode('merge')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-800">Merge Backup</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pl-5 font-medium">
                Merges records into existing IndexedDB without duplicates. Perfect for continuing on a new device.
              </p>
            </div>

            {/* Replace Option */}
            <div
              onClick={() => setSelectedMode('replace')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMode === 'replace'
                  ? 'border-rose-600 bg-rose-50/40 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="radio"
                  name="importMode"
                  checked={selectedMode === 'replace'}
                  onChange={() => setSelectedMode('replace')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm font-bold text-slate-800">Replace Local Database</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pl-5 font-medium">
                Wipes current local database and replaces entirely with this backup.
              </p>
            </div>
          </div>
        </div>

        {/* Warning if Replace is selected */}
        {selectedMode === 'replace' && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Warning:</strong> Current local records will be completely overwritten by this backup. Make sure you have exported your current data if needed.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isImporting}
            onClick={handleImport}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50 ${
              selectedMode === 'replace'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
            <span>{isImporting ? 'Importing Data...' : `Confirm & ${selectedMode === 'merge' ? 'Merge' : 'Replace'}`}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
