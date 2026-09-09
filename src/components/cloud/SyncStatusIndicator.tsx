import React, { useState, useEffect } from 'react';
import { CloudSyncService } from '../../services/cloudSyncService';
import { AccountService } from '../../services/accountService';
import { SyncState, StaffPayAccount } from '../../types/cloud';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, User } from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(CloudSyncService.getSyncState());
  const [activeAccount, setActiveAccount] = useState<StaffPayAccount | null>(AccountService.getActiveAccount());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    const unsubSync = CloudSyncService.subscribe((state) => {
      setSyncState({ ...state });
      setActiveAccount(AccountService.getActiveAccount());
    });

    return () => {
      unsubSync();
    };
  }, []);

  if (!activeAccount) {
    return null;
  }

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (manualSyncing || syncState.status === 'syncing') return;
    setManualSyncing(true);
    try {
      await CloudSyncService.sync();
    } catch (err) {
      console.error('Manual sync failed', err);
    } finally {
      setManualSyncing(false);
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = () => {
    const isSyncing = syncState.status === 'syncing' || manualSyncing;

    if (isSyncing) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span className="hidden sm:inline">Syncing...</span>
        </div>
      );
    }

    if (syncState.status === 'offline') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
          <CloudOff className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Offline</span>
          {syncState.pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {syncState.pendingCount}
            </span>
          )}
        </div>
      );
    }

    if (syncState.status === 'error') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          <span className="hidden sm:inline">Sync Error</span>
        </div>
      );
    }

    if (syncState.pendingCount > 0) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="hidden sm:inline">{syncState.pendingCount} pending</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span className="hidden sm:inline">Synced</span>
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-1.5 hover:opacity-80 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
        title={`StaffPay Cloud Sync: ${syncState.status} (Click for details)`}
        type="button"
      >
        {getStatusBadge()}
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">StaffPay Cloud Sync</h4>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-700">{activeAccount.username}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Status:</span>
                <span className="font-medium capitalize text-slate-800 flex items-center gap-1">
                  {syncState.status === 'synced' && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  {syncState.status === 'syncing' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin"></span>}
                  {syncState.status === 'offline' && <span className="w-2 h-2 rounded-full bg-slate-400"></span>}
                  {syncState.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                  {syncState.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Last Synced:</span>
                <span className="font-medium text-slate-800">
                  {formatLastSync(syncState.lastSyncAt)}
                </span>
              </div>

              {syncState.pendingCount > 0 && (
                <div className="flex justify-between items-center text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                  <span>Pending changes:</span>
                  <span className="font-bold">{syncState.pendingCount}</span>
                </div>
              )}

              {syncState.lastError && (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-md border border-red-100 mt-1">
                  {syncState.lastError}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleManualSync}
                disabled={manualSyncing || syncState.status === 'syncing'}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
                type="button"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${manualSyncing || syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                {manualSyncing || syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
