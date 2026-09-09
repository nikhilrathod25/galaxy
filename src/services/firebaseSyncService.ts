import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { firestore, auth } from './firebase';
import { db } from '../db/database';
import { AccountService } from './accountService';
import {
  CloudDatabase,
  SyncState,
  SyncResult,
  LeaveType,
} from '../types/cloud';
import {
  Employee,
  AttendanceRecord,
  LeaveRecord,
  Holiday,
  FinalizedSalaryRecord,
  AppSettingEntry,
} from '../types';

type SyncListener = (state: SyncState) => void;

export class FirebaseSyncService {
  private static isSyncing = false;
  private static debounceTimer: any = null;
  private static syncListeners: SyncListener[] = [];
  private static pendingChanges = 0;
  private static isCloudOriginUpdate = false;
  private static unsubscribeSnapshot: Unsubscribe | null = null;
  private static currentAccountId: string | null = null;
  private static isInitialized = false;

  private static syncState: SyncState = {
    status: 'unauthenticated',
    lastSyncAt: localStorage.getItem('staffpay_last_sync_at'),
    lastRemoteRevision: parseInt(localStorage.getItem('staffpay_last_revision') || '0', 10),
    pendingCount: 0,
    lastError: null,
    connectedEmail: null,
    activeUsername: null,
    activeAccountId: null,
  };

  /**
   * Initializes real-time Firestore sync and event listeners
   */
  static async initialize(): Promise<void> {
    await AccountService.syncAllLocalAccountsToCloud().catch(() => {});
    const account = AccountService.getActiveAccount();
    const currentUser = auth.currentUser;

    if (!account) {
      this.syncState.status = 'unauthenticated';
      this.syncState.activeUsername = null;
      this.syncState.activeAccountId = null;
      this.syncState.connectedEmail = null;
      this.emitSyncState();
      this.cleanupListener();
      return;
    }

    this.syncState.activeUsername = account.username;
    this.syncState.activeAccountId = account.accountId;
    this.syncState.connectedEmail = currentUser?.email || `${account.username}@staffpay.app`;
    this.syncState.status = navigator.onLine ? 'pending' : 'offline';
    this.emitSyncState();

    // Start real-time Firestore listener for this account
    this.attachRealtimeListener(account.username);

    if (!this.isInitialized) {
      this.isInitialized = true;

      window.addEventListener('online', () => {
        if (AccountService.getActiveAccount()) {
          this.syncState.status = 'pending';
          this.emitSyncState();
          this.sync();
        }
      });

      window.addEventListener('offline', () => {
        this.syncState.status = 'offline';
        this.emitSyncState();
      });

      window.addEventListener('focus', () => {
        if (navigator.onLine && AccountService.getActiveAccount() && !this.isSyncing) {
          this.sync();
        }
      });
    }

    // Initial sync
    await this.sync();
  }

  // Alias for initialize
  static async init(): Promise<void> {
    return this.initialize();
  }

  /**
   * Helper to get stable normalized Firestore document reference by username
   */
  private static getAccountDocRef(username: string) {
    const key = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    return doc(firestore, 'accounts', `u_${key}`, 'cloud_data', 'main');
  }

  /**
   * Attaches real-time Firestore listener to automatically update local state when changed on another device
   */
  private static attachRealtimeListener(username: string): void {
    const key = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    if (this.currentAccountId === key && this.unsubscribeSnapshot) {
      return;
    }

    this.cleanupListener();
    this.currentAccountId = key;

    try {
      const docRef = this.getAccountDocRef(username);
      this.unsubscribeSnapshot = onSnapshot(
        docRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            // First time this account is seen in Firestore
            const localData = await this.collectLocalData();
            const hasLocalData =
              localData.employees.length > 0 ||
              localData.attendance.length > 0 ||
              localData.salaryRecords.length > 0;

            if (hasLocalData) {
              await this.sync();
            }
            return;
          }

          if (this.isSyncing) return;

          const remoteDb = snapshot.data() as CloudDatabase;
          if (remoteDb) {
            const localRevision = parseInt(
              localStorage.getItem('staffpay_last_revision') || '0',
              10
            );
            if ((remoteDb.revision || 0) > localRevision) {
              await this.sync();
            }
          }
        },
        (error) => {
          console.warn('Firestore real-time listener notice:', error);
        }
      );
    } catch (e) {
      console.warn('Could not attach Firestore listener:', e);
    }
  }

  private static cleanupListener(): void {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    this.currentAccountId = null;
  }

  static getSyncState(): SyncState {
    const account = AccountService.getActiveAccount();
    return {
      ...this.syncState,
      activeUsername: account?.username || null,
      activeAccountId: account?.accountId || null,
    };
  }

  static subscribe(listener: SyncListener): () => void {
    this.syncListeners.push(listener);
    const account = AccountService.getActiveAccount();
    listener({
      ...this.syncState,
      activeUsername: account?.username || null,
      activeAccountId: account?.accountId || null,
    });
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private static emitSyncState(): void {
    this.syncState.pendingCount = this.pendingChanges;
    const account = AccountService.getActiveAccount();
    const payload = {
      ...this.syncState,
      activeUsername: account?.username || null,
      activeAccountId: account?.accountId || null,
    };
    this.syncListeners.forEach((l) => l(payload));
  }

  /**
   * Called whenever local data is created, updated, or deleted
   */
  static notifyMutation(): void {
    if (this.isCloudOriginUpdate) {
      return;
    }

    this.pendingChanges++;
    if (this.syncState.status === 'synced') {
      this.syncState.status = 'pending';
    }
    this.emitSyncState();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (navigator.onLine && AccountService.getActiveAccount()) {
      this.debounceTimer = setTimeout(() => {
        this.sync();
      }, 1500);
    }
  }

  /**
   * Bi-Directional Synchronization between Local IndexedDB and Firestore
   */
  static async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedAt: new Date().toISOString(),
        pulledCounts: { employees: 0, attendance: 0, leaves: 0, holidays: 0, salaryRecords: 0 },
        error: 'Sync already in progress',
      };
    }

    const account = AccountService.getActiveAccount();
    if (!account) {
      this.syncState.status = 'unauthenticated';
      this.emitSyncState();
      return {
        success: false,
        syncedAt: new Date().toISOString(),
        pulledCounts: { employees: 0, attendance: 0, leaves: 0, holidays: 0, salaryRecords: 0 },
        error: 'No active account',
      };
    }

    if (!navigator.onLine) {
      this.syncState.status = 'offline';
      this.emitSyncState();
      return {
        success: false,
        syncedAt: new Date().toISOString(),
        pulledCounts: { employees: 0, attendance: 0, leaves: 0, holidays: 0, salaryRecords: 0 },
        error: 'Offline',
      };
    }

    this.isSyncing = true;
    this.syncState.status = 'syncing';
    this.emitSyncState();

    try {
      const docRef = this.getAccountDocRef(account.username);
      const docSnap = await getDoc(docRef);

      let remoteDb: CloudDatabase;
      if (docSnap.exists()) {
        remoteDb = docSnap.data() as CloudDatabase;
      } else {
        remoteDb = this.createDefaultCloudDatabase(account);
      }

      // 1. Collect local IndexedDB contents
      const localData = await this.collectLocalData();

      // 2. Merge records deterministically
      const mergedEmployees = this.mergeEmployees(localData.employees, remoteDb.employees || []);
      const mergedAttendance = this.mergeAttendance(localData.attendance, remoteDb.attendance || []);
      const mergedLeaveTypes = this.mergeLeaveTypes(localData.leaveTypes, remoteDb.leaveTypes || []);
      const mergedLeaves = this.mergeLeaves(localData.leaves, remoteDb.leaves || []);
      const mergedHolidays = this.mergeHolidays(localData.holidays, remoteDb.holidays || []);
      const mergedSalary = this.mergeSalaryRecords(localData.salaryRecords, remoteDb.salaryRecords || []);
      const mergedSettings = this.mergeSettings(localData.settings, remoteDb.settings || []);

      // 3. Apply merged records into local Dexie IndexedDB
      this.isCloudOriginUpdate = true;
      try {
        await db.transaction(
          'rw',
          [
            db.employees,
            db.attendance,
            db.leave_types,
            db.leaves,
            db.holidays,
            db.salary_records,
            db.settings,
          ],
          async () => {
            await db.employees.clear();
            await db.attendance.clear();
            await db.leave_types.clear();
            await db.leaves.clear();
            await db.holidays.clear();
            await db.salary_records.clear();
            await db.settings.clear();

            if (mergedEmployees.length) await db.employees.bulkAdd(mergedEmployees);
            if (mergedAttendance.length) await db.attendance.bulkAdd(mergedAttendance);
            if (mergedLeaveTypes.length) await db.leave_types.bulkAdd(mergedLeaveTypes);
            if (mergedLeaves.length) await db.leaves.bulkAdd(mergedLeaves);
            if (mergedHolidays.length) await db.holidays.bulkAdd(mergedHolidays);
            if (mergedSalary.length) await db.salary_records.bulkAdd(mergedSalary);
            if (mergedSettings.length) await db.settings.bulkAdd(mergedSettings);
          }
        );
      } finally {
        this.isCloudOriginUpdate = false;
      }

      // Notify active UI components that database has been refreshed from cloud
      try {
        window.dispatchEvent(new CustomEvent('staffpay_database_updated'));
      } catch (e) {
        // Ignore in non-DOM environments
      }

      // 4. Update Firestore cloud database atomically
      const now = new Date().toISOString();
      const nextRevision = (remoteDb.revision || 0) + 1;

      const updatedCloudDb: CloudDatabase = {
        schemaVersion: 2,
        appName: 'StaffPay',
        appVersion: '1.0.0',
        databaseVersion: db.verno,
        accountId: account.accountId,
        ownerUsername: account.username,
        ownerGoogleAccount: auth.currentUser?.email || `${account.username}@staffpay.app`,
        lastModifiedAt: now,
        revision: nextRevision,
        employees: mergedEmployees,
        attendance: mergedAttendance,
        leaveTypes: mergedLeaveTypes,
        leaves: mergedLeaves,
        holidays: mergedHolidays,
        salaryRecords: mergedSalary,
        settings: mergedSettings,
      };

      await setDoc(docRef, updatedCloudDb);

      this.pendingChanges = 0;
      this.syncState.lastSyncAt = now;
      this.syncState.lastRemoteRevision = nextRevision;
      this.syncState.status = 'synced';
      this.syncState.lastError = null;

      localStorage.setItem('staffpay_last_sync_at', now);
      localStorage.setItem('staffpay_last_revision', String(nextRevision));
      this.emitSyncState();

      return {
        success: true,
        syncedAt: now,
        pulledCounts: {
          employees: mergedEmployees.length,
          attendance: mergedAttendance.length,
          leaves: mergedLeaves.length,
          holidays: mergedHolidays.length,
          salaryRecords: mergedSalary.length,
        },
        pushedRevision: nextRevision,
      };
    } catch (err: any) {
      console.error('Firebase Cloud Sync Error:', err);
      this.syncState.status = 'error';
      this.syncState.lastError = err.message || 'Cloud sync error';
      this.emitSyncState();

      return {
        success: false,
        syncedAt: new Date().toISOString(),
        pulledCounts: { employees: 0, attendance: 0, leaves: 0, holidays: 0, salaryRecords: 0 },
        error: err.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private static async collectLocalData() {
    const [employees, attendance, leaveTypes, leaves, holidays, salaryRecords, settings] =
      await Promise.all([
        db.employees.toArray(),
        db.attendance.toArray(),
        db.leave_types.toArray(),
        db.leaves.toArray(),
        db.holidays.toArray(),
        db.salary_records.toArray(),
        db.settings.toArray(),
      ]);

    return { employees, attendance, leaveTypes, leaves, holidays, salaryRecords, settings };
  }

  /**
   * Resets cloud database in Firestore to a clean empty state
   */
  static async clearCloudDatabase(username?: string): Promise<void> {
    const account = AccountService.getActiveAccount();
    const targetUsername = username || account?.username;
    if (!targetUsername) return;

    try {
      const docRef = this.getAccountDocRef(targetUsername);
      const emptyDb = this.createDefaultCloudDatabase({
        accountId: account?.accountId || `sp_${targetUsername}`,
        username: targetUsername,
        companyName: account?.companyName || 'StaffPay Business',
      });
      await setDoc(docRef, emptyDb);
      localStorage.setItem('staffpay_last_revision', '1');
      localStorage.setItem('staffpay_last_sync_at', new Date().toISOString());
      this.syncState.lastRemoteRevision = 1;
      this.syncState.pendingCount = 0;
      this.syncState.status = 'synced';
      this.emitSyncState();
    } catch (e) {
      console.warn('Failed to clear cloud database:', e);
    }
  }

  private static createDefaultCloudDatabase(account: { accountId: string; username: string; companyName?: string }): CloudDatabase {
    const defaultSettings: AppSettingEntry[] = [
      {
        key: 'company_info',
        value: {
          companyName: account.companyName || 'StaffPay Business',
          tagline: 'Employee Attendance & Salary Management',
          address: 'Main Road, Business Hub',
          phone: '+91 98765 43210',
          email: `${account.username}@staffpay.app`,
          authorizedSignatory: 'Authorized Signatory',
        },
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'salary_settings',
        value: {
          defaultCalculationMode: 'working_days',
          workingDaysPerWeek: 6,
          excludeSundays: true,
          excludeHolidays: true,
        },
        updatedAt: new Date().toISOString(),
      },
    ];

    const defaultLeaveTypes: LeaveType[] = [
      { name: 'Casual Leave', isPaid: true, description: 'General personal leave' },
      { name: 'Sick Leave', isPaid: true, description: 'Medical recovery' },
      { name: 'Unpaid Leave', isPaid: false, description: 'Leave without pay' },
    ];

    return {
      schemaVersion: 2,
      appName: 'StaffPay',
      appVersion: '1.0.0',
      databaseVersion: db.verno,
      accountId: account.accountId,
      ownerUsername: account.username,
      ownerGoogleAccount: auth.currentUser?.email || '',
      lastModifiedAt: new Date().toISOString(),
      revision: 1,
      employees: [],
      attendance: [],
      leaveTypes: defaultLeaveTypes,
      leaves: [],
      holidays: [],
      salaryRecords: [],
      settings: defaultSettings,
    };
  }

  // --- Record-Level Merging Utilities ---

  private static mergeEmployees(local: Employee[], remote: Employee[]): Employee[] {
    const map = new Map<string, Employee>();
    local.forEach((e) => {
      if (e.employeeId) map.set(e.employeeId, e);
    });

    remote.forEach((r) => {
      if (!r.employeeId) return;
      const existing = map.get(r.employeeId);
      if (!existing) {
        map.set(r.employeeId, r);
      } else {
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const remoteTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
        if (remoteTime >= localTime) {
          map.set(r.employeeId, { ...existing, ...r });
        }
      }
    });

    return Array.from(map.values());
  }

  private static mergeAttendance(
    local: AttendanceRecord[],
    remote: AttendanceRecord[]
  ): AttendanceRecord[] {
    const map = new Map<string, AttendanceRecord>();
    local.forEach((a) => {
      const key = a.id || `${a.employeeId}_${a.date}`;
      map.set(key, a);
    });

    remote.forEach((r) => {
      const key = r.id || `${r.employeeId}_${r.date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        const localTime = new Date(existing.updatedAt || 0).getTime();
        const remoteTime = new Date(r.updatedAt || 0).getTime();
        if (remoteTime >= localTime) {
          map.set(key, { ...existing, ...r });
        }
      }
    });

    return Array.from(map.values());
  }

  private static mergeLeaveTypes(local: LeaveType[], remote: LeaveType[]): LeaveType[] {
    const map = new Map<string, LeaveType>();
    local.forEach((l) => map.set(l.name.toLowerCase(), l));
    remote.forEach((r) => {
      if (!map.has(r.name.toLowerCase())) {
        map.set(r.name.toLowerCase(), r);
      }
    });
    return Array.from(map.values());
  }

  private static mergeLeaves(local: LeaveRecord[], remote: LeaveRecord[]): LeaveRecord[] {
    const map = new Map<string, LeaveRecord>();
    local.forEach((l) => {
      const key = l.id ? String(l.id) : `${l.employeeId}_${l.startDate}`;
      map.set(key, l);
    });
    remote.forEach((r) => {
      const key = r.id ? String(r.id) : `${r.employeeId}_${r.startDate}`;
      if (!map.has(key)) {
        map.set(key, r);
      }
    });
    return Array.from(map.values());
  }

  private static mergeHolidays(local: Holiday[], remote: Holiday[]): Holiday[] {
    const map = new Map<string, Holiday>();
    local.forEach((h) => map.set(h.date, h));
    remote.forEach((r) => {
      if (!map.has(r.date)) {
        map.set(r.date, r);
      }
    });
    return Array.from(map.values());
  }

  private static mergeSalaryRecords(
    local: FinalizedSalaryRecord[],
    remote: FinalizedSalaryRecord[]
  ): FinalizedSalaryRecord[] {
    const map = new Map<string, FinalizedSalaryRecord>();
    local.forEach((s) => {
      const key = s.id || `${s.employeeId}_${s.year}_${String(s.month).padStart(2, '0')}`;
      map.set(key, s);
    });

    remote.forEach((r) => {
      const key = r.id || `${r.employeeId}_${r.year}_${String(r.month).padStart(2, '0')}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        const localTime = new Date(existing.finalizedAt || existing.updatedAt || 0).getTime();
        const remoteTime = new Date(r.finalizedAt || r.updatedAt || 0).getTime();
        if (remoteTime >= localTime) {
          map.set(key, { ...existing, ...r });
        }
      }
    });

    return Array.from(map.values());
  }

  private static mergeSettings(local: AppSettingEntry[], remote: AppSettingEntry[]): AppSettingEntry[] {
    const map = new Map<string, AppSettingEntry>();
    local.forEach((s) => map.set(s.key, s));
    remote.forEach((r) => {
      const existing = map.get(r.key);
      if (!existing) {
        map.set(r.key, r);
      } else {
        const localTime = new Date(existing.updatedAt || 0).getTime();
        const remoteTime = new Date(r.updatedAt || 0).getTime();
        if (remoteTime >= localTime) {
          map.set(r.key, { ...existing, ...r });
        }
      }
    });
    return Array.from(map.values());
  }
}
