import { Employee } from './employee';
import { AttendanceRecord } from './attendance';
import { LeaveType, LeaveRecord } from './leave';
import { Holiday } from './holiday';
import { FinalizedSalaryRecord } from './salary';
import { AppSettingEntry } from './settings';

export interface StaffPayAccount {
  accountId: string; // Unique stable ID (e.g. sp_01hf98...)
  username: string; // Normalized lowercase username
  passwordHash: string; // PBKDF2-SHA256 hash
  passwordSalt: string; // Cryptographic random salt (hex)
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'suspended';
  companyName?: string;
  email?: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
}

export interface CloudDatabase {
  schemaVersion: number;
  appName: 'StaffPay';
  appVersion: string;
  databaseVersion: number;
  accountId: string; // Bound StaffPay account ID
  ownerUsername: string; // Account username
  ownerGoogleAccount?: string;
  lastModifiedAt: string;
  revision: number;
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveTypes: LeaveType[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  salaryRecords: FinalizedSalaryRecord[];
  settings: AppSettingEntry[];
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error' | 'unauthenticated';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  lastRemoteRevision: number;
  pendingCount: number;
  lastError: string | null;
  connectedEmail: string | null;
  activeUsername?: string | null;
  activeAccountId?: string | null;
}

export interface SyncMetadata extends SyncState {}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  pulledCounts: {
    employees: number;
    attendance: number;
    leaves: number;
    holidays: number;
    salaryRecords: number;
  };
  pushedRevision?: number;
  error?: string;
}

export interface MigrationCounts {
  employees: number;
  attendance: number;
  leaves: number;
  salaryRecords: number;
  holidays: number;
  leaveTypes: number;
}

export type MigrationOption = 'upload_local' | 'start_fresh' | 'use_cloud' | 'merge_local';

export interface MigrationState {
  isOpen: boolean;
  type: 'CASE_A' | 'CASE_B' | null;
  pendingCloudDb: CloudDatabase | null;
}
