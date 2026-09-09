import React, { useState, useEffect } from 'react';
import {
  HardDriveDownload,
  Upload,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Clock,
  Database,
  Cloud,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BackupService } from '../services/backupService';
import { SettingsRepository } from '../repositories/settingsRepository';
import { BackupData, ImportResult } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';

export const BackupPage: React.FC = () => {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<{
    employees: number;
    attendance: number;
    leaves: number;
    holidays: number;
    salaryRecords: number;
  }>({
    employees: 0,
    attendance: 0,
    leaves: 0,
    holidays: 0,
    salaryRecords: 0,
  });

  const loadMeta = async () => {
    const meta = await SettingsRepository.getBackupMeta();
    setLastBackupAt(meta.lastBackupAt);
    setLastImportAt(meta.lastImportAt);

    const s = await BackupService.getSummary();
    setSummary({
      employees: s.employees,
      attendance: s.attendance,
      leaves: s.leaves,
      holidays: s.holidays,
      salaryRecords: s.salaryRecords,
    });
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await BackupService.exportBackup();
      BackupService.downloadBackupFile(backup);

      const now = new Date().toISOString();
      setLastBackupAt(now);
      await SettingsRepository.updateBackupMeta({
        lastBackupAt: now,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const validation = BackupService.validateBackupJSON(text);
        if (!validation.isValid) {
          throw new Error('Invalid backup file: ' + validation.errors.join(', '));
        }

        const parsed: BackupData = JSON.parse(text);
        setIsImporting(true);
        const result = await BackupService.importBackup(parsed, 'merge');
        setImportResult(result);
        await loadMeta();

        if (result.success) {
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse JSON file.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Database Backup & Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export full JSON snapshots of your Supabase Cloud PostgreSQL database or restore data from a file.
        </p>
      </div>

      {/* Cloud Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Supabase Cloud Database Status</h2>
              <p className="text-xs text-slate-500">Live counts across all tables in your cloud database</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Cloud
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-blue-950">{summary.employees}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Employees</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-blue-950">{summary.attendance}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Attendance</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-blue-950">{summary.leaves}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Leaves</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-blue-950">{summary.holidays}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Holidays</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center col-span-2 sm:col-span-1">
            <div className="text-xl font-extrabold text-blue-950">{summary.salaryRecords}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Salary Slips</div>
          </div>
        </div>
      </div>

      {/* Export & Import Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Export Cloud Backup</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download a complete JSON copy of all employees, attendance history, finalized payroll records, and settings.
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Exported: </span>
              <span className="font-semibold text-slate-700">
                {lastBackupAt ? formatDisplayDate(lastBackupAt, 'dd MMM yyyy, hh:mm a') : 'Never'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>{isExporting ? 'Generating JSON...' : 'Download Cloud Backup JSON'}</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Import / Restore Backup</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a previously exported StaffPay JSON file to restore records directly into Supabase Cloud.
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Imported: </span>
              <span className="font-semibold text-slate-700">
                {lastImportAt ? formatDisplayDate(lastImportAt, 'dd MMM yyyy, hh:mm a') : 'Never'}
              </span>
            </div>
          </div>

          <div>
            <label className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Importing to Cloud...' : 'Select JSON File to Restore'}</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Import Status Alert */}
      {importResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {importResult.message ||
              `Import completed successfully! Restored ${importResult.importedCounts.employees} employees and ${importResult.importedCounts.attendance} attendance records to Supabase Cloud.`}
          </span>
        </div>
      )}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
