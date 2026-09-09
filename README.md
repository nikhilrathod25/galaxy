# StaffPay — Multi-Device Cloud Data & Account Authentication System

> **Subtitle:** Employee Attendance, Leave & Salary Management System with Username/Password Authentication and Google Drive Central Sync  
> **Hosting Cost:** ₹0/month (100% static React/Vite deployable to GitHub Pages, Cloudflare Pages, or Netlify)  
> **Architecture:** StaffPay Account (PBKDF2-SHA256) + Google Drive `appDataFolder` (Master Cloud DB) + IndexedDB/Dexie (Local Working Cache)

---

## 1. Multi-Device Architecture Overview

StaffPay delivers a zero-backend, multi-device business management system where the **same StaffPay account** (Username + Password) accessed from any browser or device connects to the **same central company dataset**:

```
                    STAFFPAY USER
                         │
                         ▼
             USERNAME + PASSWORD LOGIN
            (PBKDF2-SHA256 Salted Hash)
                         │
                         ▼
                 STAFFPAY ACCOUNT
              (Unique Account ID: sp_...)
                         │
                         ▼
             GOOGLE DRIVE (appDataFolder)
                         │
         staffpay-database-{accountId}.json (Master DB)
                         │
                    Sync Layer (Debounced + Loop-Protected)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Chrome          Edge           Mobile
      Device A        Device A        Device B
          │              │              │
    IndexedDB Cache  IndexedDB Cache IndexedDB Cache
          │              │              │
          └────── Same StaffPay Account ─┘
                         │
                         ▼
                    SAME DATA
```

- **StaffPay Account Layer:** Username + Password authentication with per-account salt and PBKDF2-HMAC-SHA256 hashing. Passwords are never stored or transmitted in plaintext.
- **Google Drive (`appDataFolder`):** Authoritative central cloud storage holding account-specific database payloads (`staffpay-database-{accountId}.json`).
- **IndexedDB (`StaffPayDB` via Dexie.js):** High-speed local offline cache for instant UI response and offline operations.
- **₹0 Hosting Cost:** 100% static frontend deployable to GitHub Pages with no Node.js, Express, PHP, Laravel, or paid backend server dependencies.

---

## 2. Multi-Device & Account Isolation Workflow

### Scenario 1: Accessing Same Account Across Devices
1. **Device A (Chrome):**
   - Log in with `admin001` / `MyPassword123`.
   - Add Employee: `Rahul Sharma` (Salary: ₹30,000).
   - Mark Attendance: `09/09/2026 = Present`.
   - The sync engine automatically batches and writes changes to `staffpay-database-{accountId}.json` in Google Drive.
2. **Device B (Edge / Mobile):**
   - Open StaffPay and log in with the **same** `admin001` / `MyPassword123`.
   - StaffPay downloads the master cloud database and syncs it into Device B's local IndexedDB.
   - `Rahul Sharma` and the September attendance appear immediately.
3. **Device B:** Change `10/09/2026 = Absent`.
4. **Device A:** Syncs automatically and reflects `10/09/2026 = Absent` with 0 duplicate records.

### Scenario 2: Strict Account Isolation
- `admin001` accesses only Company A's dataset (`staffpay-database-sp_...A.json`).
- `admin002` accesses only Company B's dataset (`staffpay-database-sp_...B.json`).
- Switching accounts safely flushes the active working cache and loads the new account's data. Data from Account A will never leak into Account B.

---

## 3. Record-Level Merging & Conflict Protection

To eliminate the risk of whole-file overwrites across multiple devices:

| Entity | Unique Composite Key | Deterministic Merge Rule |
| :--- | :--- | :--- |
| **Employee** | `employeeId` | Higher `updatedAt` / `createdAt` timestamp |
| **Attendance** | `${employeeId}_${date}` | Higher `updatedAt` timestamp (Prevents duplicate daily logs) |
| **Salary Record** | `${employeeId}_${year}_${month}` | Higher `finalizedAt` timestamp (Prevents duplicate finalized records) |
| **Holiday** | `date` (`YYYY-MM-DD`) | Unique per date |
| **Leave Type** | `name` (lowercase) | Unique per name |
| **Settings** | `key` | Higher `updatedAt` timestamp |

---

## 4. Google Cloud Console Setup (Step-by-Step)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `StaffPay`).
2. Under **APIs & Services** > **Library**, search for **Google Drive API** and click **Enable**.
3. Under **OAuth consent screen**:
   - Select **External** user type.
   - Add scope: `https://www.googleapis.com/auth/drive.appdata` (and `userinfo.email`).
   - Add your Google account email under **Test Users**.
4. Under **Credentials** > **Create Credentials** > **OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:3000` (Local Vite dev server)
     - `http://localhost:5173`
     - `https://YOUR_GITHUB_USERNAME.github.io` (GitHub Pages production domain)
5. Copy the Client ID and add it to `.env.local`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

---

## 5. Offline-First Capability

StaffPay is built offline-first:
- If the internet connection drops or Google Drive is temporarily unavailable:
  - Users can still log in using the cached credential verification.
  - All employee, attendance, holiday, leave, salary calculations, and PDF salary slip generation remain 100% functional.
  - Local modifications enter a pending sync queue (`● Offline (X pending)`).
- When internet connectivity returns, StaffPay automatically reconciles revisions and pushes pending changes to the cloud master database.

---

## 6. Standalone Emergency JSON Backups

In addition to central Google Drive master synchronization, the standalone **Backup & Restore** page remains fully available:
- **Export Full JSON Backup:** Download a portable `.json` file for offline storage.
- **Import JSON Backup:** Pre-flight validation with safe Merge / Replace options.
- **Log Out:** Safely closes the active account session on the device.

---

## 7. Build & Deployment to GitHub Pages

### Install Dependencies:
```bash
npm install
```

### Start Development Server:
```bash
npm run dev
```

### Build for Production (GitHub Pages):
```bash
npm run build
```

### Deploying to GitHub Pages:
1. Push repository to GitHub.
2. In GitHub repository **Settings** > **Pages**:
   - Set **Source** to **GitHub Actions** (or deploy `dist/` directory via `gh-pages` branch).
3. Ensure your production GitHub Pages origin (`https://YOUR_USERNAME.github.io`) is added under Authorized JavaScript origins in Google Cloud Console.

---

## 8. Security & Privacy Guarantees

- **No Plaintext Passwords:** Passwords are salted with 16 bytes of cryptographic random bytes and hashed using PBKDF2-HMAC-SHA256 (100,000 iterations).
- **Private Drive Storage:** Uses `drive.appdata` restricted space. StaffPay can never read or write any personal files outside its own appData folder.
- **Optional Local PIN Lock:** Client-side lock using SHA-256 Web Crypto API for shared office computers.
