import { db } from '../db/database';
import { GoogleAuthService } from './googleAuthService';
import { GoogleDriveService, DriveFileInfo } from './googleDriveService';
import { AccountService } from './accountService';
import { FirebaseSyncService } from './firebaseSyncService';
import {
  CloudDatabase,
  SyncState,
  SyncResult,
  MigrationCounts,
  MigrationOption,
  MigrationState,
} from '../types/cloud';
import {
  Employee,
  AttendanceRecord,
  LeaveType,
  LeaveRecord,
  Holiday,
  FinalizedSalaryRecord,
  AppSettingEntry,
} from '../types';

type SyncListener = (state: SyncState) => void;
type MigrationListener = (state: MigrationState) => void;

export class CloudSyncService {
  private static isSyncing = false;
  private static debounceTimer: any = null;
  private static syncListeners: SyncListener[] = [];
  private static migrationListeners: MigrationListener[] = [];
  private static fileInfo: DriveFileInfo | null = null;
  private static pendingChanges = 0;
  private static isCloudOriginUpdate = false; // Protects against infinite sync loops

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

  private static migrationState: MigrationState = {
    isOpen: false,
    type: null,
    pendingCloudDb: null,
  };

  private static localCountsCache: MigrationCounts | null = null;
  private static cloudCountsCache: MigrationCounts | null = null;
  private static isInitialized = false;

  /**
   * Initializes event listeners for online restoration, tab focus, and startup check
   */
  static async initialize(): Promise<void> {
    const account = AccountService.getActiveAccount();
    const googleUser = GoogleAuthService.getCurrentUser();

    if (!account) {
      this.syncState.status = 'unauthenticated';
      this.syncState.activeUsername = null;
      this.syncState.activeAccountId = null;
      this.emitSyncState();
      return;
    }

    this.syncState.activeUsername = account.username;
    this.syncState.activeAccountId = account.accountId;
    this.syncState.connectedEmail = googleUser?.email || null;
    this.syncState.status = googleUser ? (navigator.onLine ? 'pending' : 'offline') : 'unauthenticated';
    this.syncState.lastError = null;
    this.emitSyncState();

    if (!this.isInitialized) {
      this.isInitialized = true;

      // Auto-sync on network reconnect
      window.addEventListener('online', () => {
        if (AccountService.getActiveAccount() && GoogleAuthService.isAuthenticated()) {
          this.syncState.status = 'pending';
          this.emitSyncState();
          this.sync();
        }
      });

      window.addEventListener('offline', () => {
        if (GoogleAuthService.isAuthenticated()) {
          this.syncState.status = 'offline';
          this.emitSyncState();
        }
      });

      // Auto-sync on window focus
      window.addEventListener('focus', () => {
        if (navigator.onLine && AccountService.getActiveAccount() && GoogleAuthService.isAuthenticated() && !this.isSyncing) {
          this.sync();
        }
      });

      // Listen to Google Auth changes
      GoogleAuthService.onAuthStateChanged((u) => {
        const acc = AccountService.getActiveAccount();
        if (acc) {
          this.syncState.connectedEmail = u?.email || null;
          this.syncState.activeUsername = acc.username;
          this.syncState.activeAccountId = acc.accountId;
          if (u) {
            this.syncState.status = navigator.onLine ? 'pending' : 'offline';
            this.emitSyncState();
            this.checkAndMigrate();
          } else {
            this.syncState.status = 'unauthenticated';
            this.syncState.lastError = null;
            this.emitSyncState();
          }
        }
      });
    }

    if (GoogleAuthService.isAuthenticated()) {
      await this.checkAndMigrate();
    }
  }

  // Alias for initialize
  static async init(): Promise<void> {
    return this.initialize();
  }

  static getSyncState(): SyncState {
    const account = AccountService.getActiveAccount();
    return {
      ...this.syncState,
      activeUsername: account?.username || null,
      activeAccountId: account?.accountId || null,
    };
  }

  static getMigrationState(): MigrationState {
    return { ...this.migrationState };
  }

  static getLocalCounts(): MigrationCounts | null {
    return this.localCountsCache;
  }

  static getCloudCounts(): MigrationCounts | null {
    return this.cloudCountsCache;
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

  static subscribeMigration(listener: MigrationListener): () => void {
    this.migrationListeners.push(listener);
    listener({ ...this.migrationState });
    return () => {
      this.migrationListeners = this.migrationListeners.filter((l) => l !== listener);
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

  private static emitMigrationState(): void {
    this.migrationListeners.forEach((l) => l({ ...this.migrationState }));
  }

  /**
   * Called by Repositories whenever local data is created, updated, or deleted
   */
  static notifyMutation(): void {
    if (this.isCloudOriginUpdate) {
      // Ignore mutations caused by pulling from cloud
      return;
    }

    this.pendingChanges++;
    if (this.syncState.status === 'synced') {
      this.syncState.status = 'pending';
    }
    this.emitSyncState();

    FirebaseSyncService.notifyMutation();

    // Debounce cloud write (2000ms)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (navigator.onLine && AccountService.getActiveAccount() && GoogleAuthService.isAuthenticated()) {
      this.debounceTimer = setTimeout(() => {
        this.sync();
      }, 2000);
    }
  }

  /**
   * First-time account migration workflow check
   */
  private static async checkAndMigrate(): Promise<void> {
    const account = AccountService.getActiveAccount();
    if (!account || !navigator.onLine || !GoogleAuthService.isAuthenticated()) return;

    try {
      const localEmp = await db.employees.count();
      const localAtt = await db.attendance.count();
      const localSal = await db.salary_records.count();
      const localLeaves = await db.leaves.count();
      const localHol = await db.holidays.count();
      const localTypes = await db.leave_types.count();

      const hasLocalData = localEmp > 0 || localAtt > 0 || localSal > 0;

      this.localCountsCache = {
        employees: localEmp,
        attendance: localAtt,
        leaves: localLeaves,
        salaryRecords: localSal,
        holidays: localHol,
        leaveTypes: localTypes,
      };

      // Search Google Drive for account's database file
      this.fileInfo = await GoogleDriveService.findDatabaseFile(account.accountId);

      if (!this.fileInfo) {
        // CASE A: No cloud database exists for this account
        if (hasLocalData) {
          this.migrationState = {
            isOpen: true,
            type: 'CASE_A',
            pendingCloudDb: null,
          };
          this.emitMigrationState();
          return;
        } else {
          // Brand new account: auto-create initial cloud database
          await this.createInitialCloudDatabase(account);
          await this.sync();
          return;
        }
      }

      // Cloud database exists -> Download and inspect
      const cloudDb = await GoogleDriveService.downloadDatabase(this.fileInfo.id);
      this.validateCloudSchema(cloudDb);

      const cloudEmp = cloudDb.employees?.length || 0;
      const cloudAtt = cloudDb.attendance?.length || 0;
      const cloudLeaves = cloudDb.leaves?.length || 0;
      const cloudSal = cloudDb.salaryRecords?.length || 0;
      const hasCloudData = cloudEmp > 0 || cloudAtt > 0 || cloudSal > 0;

      this.cloudCountsCache = {
        employees: cloudEmp,
        attendance: cloudAtt,
        leaves: cloudLeaves,
        salaryRecords: cloudSal,
        holidays: cloudDb.holidays?.length || 0,
        leaveTypes: cloudDb.leaveTypes?.length || 0,
      };

      // CASE B: Cloud has data AND local has data on fresh device
      const migrationHandledKey = `staffpay_migrated_${account.accountId}`;
      const isAlreadyMigrated = localStorage.getItem(migrationHandledKey) === 'true';

      if (hasCloudData && hasLocalData && !isAlreadyMigrated) {
        this.migrationState = {
          isOpen: true,
          type: 'CASE_B',
          pendingCloudDb: cloudDb,
        };
        this.emitMigrationState();
        return;
      }

      localStorage.setItem(migrationHandledKey, 'true');
      await this.sync();
    } catch (err: any) {
      console.warn('Initial migration check notice:', err);
      this.sync().catch(() => {});
    }
  }

  /**
   * Completes user selection from Migration Modal
   */
  static async completeMigration(option: MigrationOption): Promise<void> {
    const account = AccountService.getActiveAccount();
    if (!account) throw new Error('No account authenticated');

    const googleUser = GoogleAuthService.getCurrentUser();
    const migrationHandledKey = `staffpay_migrated_${account.accountId}`;

    if (option === 'upload_local') {
      const localData = await this.collectLocalData();
      const cloudDb: CloudDatabase = {
        schemaVersion: 2,
        appName: 'StaffPay',
        appVersion: '1.0.0',
        databaseVersion: db.verno,
        accountId: account.accountId,
        ownerUsername: account.username,
        ownerGoogleAccount: googleUser?.email || '',
        lastModifiedAt: new Date().toISOString(),
        revision: 1,
        ...localData,
      };

      this.fileInfo = await GoogleDriveService.createDatabase(cloudDb, account.accountId);
      localStorage.setItem(migrationHandledKey, 'true');
      this.migrationState = { isOpen: false, type: null, pendingCloudDb: null };
      this.emitMigrationState();
      await this.sync();
    } else if (option === 'start_fresh') {
      await this.createInitialCloudDatabase(account);
      localStorage.setItem(migrationHandledKey, 'true');
      this.migrationState = { isOpen: false, type: null, pendingCloudDb: null };
      this.emitMigrationState();
      await this.sync();
    } else if (option === 'use_cloud') {
      if (this.migrationState.pendingCloudDb) {
        await this.applyCloudToLocal(this.migrationState.pendingCloudDb);
      }
      localStorage.setItem(migrationHandledKey, 'true');
      this.migrationState = { isOpen: false, type: null, pendingCloudDb: null };
      this.emitMigrationState();
      await this.sync();
    } else if (option === 'merge_local') {
      localStorage.setItem(migrationHandledKey, 'true');
      this.migrationState = { isOpen: false, type: null, pendingCloudDb: null };
      this.emitMigrationState();
      await this.sync();
    }
  }

  private static async createInitialCloudDatabase(account: { accountId: string; username: string; companyName?: string }): Promise<void> {
    const googleUser = GoogleAuthService.getCurrentUser();
    const defaultSettings: AppSettingEntry[] = [
      {
        key: 'company_info',
        value: {
          companyName: account.companyName || 'StaffPay Business',
          tagline: 'Employee Attendance & Salary Management',
          address: 'Main Road, Business Hub',
          phone: '+91 98765 43210',
          email: `${account.username}@staffpay.local`,
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

    const newDb: CloudDatabase = {
      schemaVersion: 2,
      appName: 'StaffPay',
      appVersion: '1.0.0',
      databaseVersion: db.verno,
      accountId: account.accountId,
      ownerUsername: account.username,
      ownerGoogleAccount: googleUser?.email || '',
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

    this.fileInfo = await GoogleDriveService.createDatabase(newDb, account.accountId);
  }

  /**
   * Bi-Directional Deterministic Synchronization Engine
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
        error: 'Not authenticated with StaffPay account',
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

    if (!GoogleAuthService.isAuthenticated()) {
      this.syncState.status = 'unauthenticated';
      this.syncState.lastError = null;
      this.emitSyncState();
      return {
        success: false,
        syncedAt: new Date().toISOString(),
        pulledCounts: { employees: 0, attendance: 0, leaves: 0, holidays: 0, salaryRecords: 0 },
        error: 'Google Drive is not connected.',
      };
    }

    this.isSyncing = true;
    this.syncState.status = 'syncing';
    this.emitSyncState();

    try {
      // 1. Find or create account's cloud database file
      if (!this.fileInfo) {
        this.fileInfo = await GoogleDriveService.findDatabaseFile(account.accountId);
        if (!this.fileInfo) {
          await this.createInitialCloudDatabase(account);
        }
      }

      if (!this.fileInfo) {
        throw new Error('Unable to locate or create Google Drive database file.');
      }

      // 2. Download remote database
      const remoteDb = await GoogleDriveService.downloadDatabase(this.fileInfo.id);
      this.validateCloudSchema(remoteDb);

      // 3. Collect local database contents
      const localData = await this.collectLocalData();

      // 4. Merge records deterministically
      const mergedEmployees = this.mergeEmployees(localData.employees, remoteDb.employees || []);
      const mergedAttendance = this.mergeAttendance(localData.attendance, remoteDb.attendance || []);
      const mergedLeaveTypes = this.mergeLeaveTypes(localData.leaveTypes, remoteDb.leaveTypes || []);
      const mergedLeaves = this.mergeLeaves(localData.leaves, remoteDb.leaves || []);
      const mergedHolidays = this.mergeHolidays(localData.holidays, remoteDb.holidays || []);
      const mergedSalary = this.mergeSalaryRecords(localData.salaryRecords, remoteDb.salaryRecords || []);
      const mergedSettings = this.mergeSettings(localData.settings, remoteDb.settings || []);

      // 5. Apply merged result into local IndexedDB without triggering loop
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

      // 6. Update cloud database atomically
      const now = new Date().toISOString();
      const nextRevision = (remoteDb.revision || 0) + 1;
      const googleUser = GoogleAuthService.getCurrentUser();

      const updatedCloudDb: CloudDatabase = {
        schemaVersion: 2,
        appName: 'StaffPay',
        appVersion: '1.0.0',
        databaseVersion: db.verno,
        accountId: account.accountId,
        ownerUsername: account.username,
        ownerGoogleAccount: googleUser?.email || remoteDb.ownerGoogleAccount || '',
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

      this.fileInfo = await GoogleDriveService.updateDatabase(this.fileInfo.id, updatedCloudDb, account.accountId);

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
      console.error('Cloud Sync Error:', err);
      this.syncState.status = 'error';
      this.syncState.lastError = err.message || 'Unknown sync error';
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

  private static async applyCloudToLocal(cloudDb: CloudDatabase): Promise<void> {
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

          if (cloudDb.employees?.length) await db.employees.bulkAdd(cloudDb.employees);
          if (cloudDb.attendance?.length) await db.attendance.bulkAdd(cloudDb.attendance);
          if (cloudDb.leaveTypes?.length) await db.leave_types.bulkAdd(cloudDb.leaveTypes);
          if (cloudDb.leaves?.length) await db.leaves.bulkAdd(cloudDb.leaves);
          if (cloudDb.holidays?.length) await db.holidays.bulkAdd(cloudDb.holidays);
          if (cloudDb.salaryRecords?.length) await db.salary_records.bulkAdd(cloudDb.salaryRecords);
          if (cloudDb.settings?.length) await db.settings.bulkAdd(cloudDb.settings);
        }
      );
    } finally {
      this.isCloudOriginUpdate = false;
    }
  }

  // --- Record-Level Deterministic Merging Utilities ---

  private static validateCloudSchema(cloud: CloudDatabase): void {
    if (!cloud || typeof cloud !== 'object') {
      throw new Error('Cloud database file is corrupted or not an object.');
    }
    if (!Array.isArray(cloud.employees) || !Array.isArray(cloud.attendance)) {
      throw new Error('Cloud database is missing required employee or attendance arrays.');
    }
  }

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
