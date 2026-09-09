import React, { useState, useEffect } from 'react';
import {
  HardDriveDownload,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  Cloud,
  LogOut,
  User,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BackupService } from '../services/backupService';
import { SettingsRepository } from '../repositories/settingsRepository';
import { AccountService } from '../services/accountService';
import { CloudSyncService } from '../services/cloudSyncService';
import { FirebaseSyncService } from '../services/firebaseSyncService';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { BackupPreviewModal } from '../components/backup/BackupPreviewModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { BackupData, BackupValidationResult, ImportMode, ImportResult } from '../types';
import { StaffPayAccount, SyncState } from '../types/cloud';
import { formatDisplayDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

export const BackupPage: React.FC = () => {
  const navigate = useNavigate();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Cloud Sync state
  const [activeAccount, setActiveAccount] = useState<StaffPayAccount | null>(AccountService.getActiveAccount());
  const [syncState, setSyncState] = useState<SyncState>(FirebaseSyncService.getSyncState());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Upload validation states
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<BackupData | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  // Clear local DB confirmation
  const [clearDataConfirmOpen, setClearDataConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadMeta = async () => {
    const meta = await SettingsRepository.getBackupMeta();
    setLastBackupAt(meta.lastBackupAt);
    setLastImportAt(meta.lastImportAt);
  };

  useEffect(() => {
    loadMeta();
    setActiveAccount(AccountService.getActiveAccount());

    const unsubSync = FirebaseSyncService.subscribe((state) => {
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
      await Promise.allSettled([FirebaseSyncService.sync(), CloudSyncService.sync()]);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 },
      });
    } catch (err: any) {
      alert(`Cloud sync failed: ${err.message}`);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleLogoutAccount = async () => {
    await FirebaseAuthService.logout();
    await AccountService.logout();
    setLogoutConfirmOpen(false);
    navigate('/login');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await BackupService.exportFullBackup();
      BackupService.downloadBackupFile(backup);
      await loadMeta();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const validation = BackupService.validateBackupJSON(text);

        if (!validation.isValid) {
          setUploadError(validation.errors.join('\n'));
          setValidationResult(null);
          setParsedBackupData(null);
          return;
        }

        const data = JSON.parse(text) as BackupData;
        setValidationResult(validation);
        setParsedBackupData(data);
        setPreviewModalOpen(true);
      } catch (err: any) {
        setUploadError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async (mode: ImportMode) => {
    if (!parsedBackupData) return;

    try {
      const result = await BackupService.importBackup(parsedBackupData, mode);
      setImportResult(result);
      await loadMeta();
      // Trigger cloud sync to propagate imported data
      CloudSyncService.notifyMutation();
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Import execution error:', err);
      setUploadError(`Failed to import backup: ${err.message}`);
    }
  };

  const handleClearDataConfirm = async () => {
    setIsClearing(true);
    try {
      await BackupService.clearAllLocalData();
      setClearDataConfirmOpen(false);
      await loadMeta();
      alert('Local database cleared successfully.');
      window.location.reload();
    } catch (err: any) {
      alert(`Clear failed: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Backup & Cloud Synchronization
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Manage central cloud sync across devices & download standalone JSON emergency backups
        </p>
      </div>

      {/* Primary Cloud Sync Card */}
      <div className="bg-white rounded-2xl border border-blue-200/80 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Google Drive Master Storage</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  Multi-Device Sync
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Account: <strong className="text-slate-800">{activeAccount?.username || 'Guest'}</strong></span>
                {activeAccount?.accountId && (
                  <span className="text-[10px] text-slate-400 font-mono">({activeAccount.accountId})</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
                  title="Log out of StaffPay account"
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
                <span>Sign In to Account</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">Status:</span>
            <span className="font-bold text-slate-800 capitalize flex items-center gap-1.5">
              {syncState.status === 'synced' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>}
              {syncState.status === 'syncing' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-spin"></span>}
              {syncState.status === 'offline' && <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>}
              {syncState.status === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>}
              {syncState.status}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">Last Cloud Sync:</span>
            <span className="font-bold text-slate-800">
              {syncState.lastSyncAt
                ? formatDisplayDate(syncState.lastSyncAt, 'dd MMM yyyy, hh:mm a')
                : 'Never'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block mb-1">Pending Local Changes:</span>
            <span className="font-bold text-slate-800">
              {syncState.pendingCount} record(s)
            </span>
          </div>
        </div>
      </div>

      {/* Standalone JSON Backup Section Header */}
      <div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Offline / Standalone JSON File Backups
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Independent file backups you can download and store on your computer or USB drive
        </p>
      </div>

      {/* Import Success Banner */}
      {importResult && (
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 shadow-sm space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-blue-900">
                Backup Successfully Restored ({importResult.mode === 'merge' ? 'Merged' : 'Replaced'})
              </h4>
              <p className="text-xs text-blue-700 mt-0.5 font-medium">
                {importResult.importedCounts.employees} employee(s), {importResult.importedCounts.attendance} attendance records, {importResult.importedCounts.salaryRecords} salary records imported.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs whitespace-pre-line font-medium">
          <div className="font-bold mb-1">Import Rejected (Database Untouched):</div>
          {uploadError}
        </div>
      )}

      {/* Two Column Grid: Export Card & Import Card in Clean Light Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Export Backup Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
              <HardDriveDownload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Export Full JSON Backup</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                Downloads complete JSON payload containing all employees, historical attendance, holidays, leave types, and finalized salary snapshots.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                Last File Export:{' '}
                <strong className="text-slate-900">
                  {lastBackupAt
                    ? formatDisplayDate(lastBackupAt, 'dd MMM yyyy, hh:mm a')
                    : 'Never'}
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all shadow-sm shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <HardDriveDownload className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Exporting...' : 'Export JSON File'}</span>
          </button>
        </div>

        {/* Import Backup Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Import & Restore File</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                Select a previously exported StaffPay backup file. Includes structural pre-flight verification before modifying your local database.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Duplicate prevention & merge mode active by default</span>
            </div>
          </div>

          <label className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]">
            <Upload className="w-4 h-4 text-orange-300" />
            <span>Select Backup File (.json)</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone: Clear Local Database */}
      <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-900">Danger Zone: Clear Local Data</h4>
            <p className="text-xs text-slate-500 font-medium">
              Permanently wipes all local employees, attendance, and salary records stored in this browser cache.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            Ensure you have exported a backup or synced to Google Drive before clearing.
          </span>
          <button
            type="button"
            onClick={() => setClearDataConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Database</span>
          </button>
        </div>
      </div>

      {/* Log Out Account Confirmation Modal */}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogoutAccount}
        title="Log Out of StaffPay"
        message="Logging out will safely close this session on this device. Your data in Google Drive remains safe and intact."
        confirmLabel="Yes, Log Out"
        variant="warning"
      />

      {/* Backup Preview Modal */}
      <BackupPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        validation={validationResult}
        backupData={parsedBackupData}
        onConfirmImport={handleConfirmImport}
      />

      {/* Clear Database Confirm Dialog */}
      <ConfirmDialog
        isOpen={clearDataConfirmOpen}
        onClose={() => setClearDataConfirmOpen(false)}
        onConfirm={handleClearDataConfirm}
        title="Clear All Local Data"
        message="This will delete ALL local employees, attendance records, leaves, holidays, and salary records from this browser cache. This action CANNOT be undone unless you have a backup or synced copy."
        confirmLabel="Yes, Clear All Data"
        variant="danger"
        isLoading={isClearing}
      />
    </div>
  );
};
