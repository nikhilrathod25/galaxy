import React, { useState } from 'react';
import { CloudSyncService } from '../../services/cloudSyncService';
import { MigrationOption } from '../../types/cloud';
import { Cloud, UploadCloud, DownloadCloud, GitMerge, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MigrationModalProps {
  type: 'CASE_A' | 'CASE_B';
  onComplete: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({ type, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localCounts = CloudSyncService.getLocalCounts();
  const cloudCounts = CloudSyncService.getCloudCounts();

  const handleAction = async (action: MigrationOption) => {
    setLoading(true);
    setError(null);
    try {
      await CloudSyncService.completeMigration(action);
      onComplete();
    } catch (err: any) {
      console.error('Migration error:', err);
      setError(err?.message || 'Failed to complete migration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {type === 'CASE_A' ? 'Upload Existing Data to Google Drive' : 'Sync Google Drive & Local Data'}
            </h3>
            <p className="text-xs text-slate-500">
              Centralizing your StaffPay database in your Google account
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {type === 'CASE_A' ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              StaffPay detected existing data stored on this browser/device. Would you like to upload it to your Google Drive to access it from anywhere?
            </p>

            {localCounts && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Local data found on this device:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>• <b>{localCounts.employees}</b> Employees</div>
                  <div>• <b>{localCounts.attendance}</b> Attendance Records</div>
                  <div>• <b>{localCounts.leaves}</b> Leave Records</div>
                  <div>• <b>{localCounts.salaryRecords}</b> Salary Records</div>
                  <div>• <b>{localCounts.holidays}</b> Holidays</div>
                  <div>• <b>{localCounts.leaveTypes}</b> Leave Types</div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => handleAction('upload_local')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                type="button"
              >
                <UploadCloud className="w-4 h-4" />
                {loading ? 'Uploading...' : 'Upload Existing Data'}
              </button>
              <button
                onClick={() => handleAction('start_fresh')}
                disabled={loading}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                type="button"
              >
                Start Fresh
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              StaffPay data was found both in your Google Drive cloud storage and locally on this device. Choose how you want to synchronize:
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 space-y-1.5">
                <div className="font-semibold text-blue-900 flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  Cloud Data:
                </div>
                {cloudCounts ? (
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div>• <b>{cloudCounts.employees}</b> Employees</div>
                    <div>• <b>{cloudCounts.attendance}</b> Attendance</div>
                    <div>• <b>{cloudCounts.leaves}</b> Leaves</div>
                    <div>• <b>{cloudCounts.salaryRecords}</b> Salary Records</div>
                  </div>
                ) : (
                  <div className="text-slate-400">Loading...</div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>📱</span>
                  Local Device Data:
                </div>
                {localCounts ? (
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div>• <b>{localCounts.employees}</b> Employees</div>
                    <div>• <b>{localCounts.attendance}</b> Attendance</div>
                    <div>• <b>{localCounts.leaves}</b> Leaves</div>
                    <div>• <b>{localCounts.salaryRecords}</b> Salary Records</div>
                  </div>
                ) : (
                  <div className="text-slate-400">Loading...</div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleAction('use_cloud')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                type="button"
              >
                <DownloadCloud className="w-4 h-4" />
                {loading ? 'Processing...' : 'Use Google Drive Data (Recommended)'}
              </button>

              <button
                onClick={() => handleAction('merge_local')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                type="button"
              >
                <GitMerge className="w-4 h-4" />
                Merge Local with Cloud Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
