# StaffPay – Supabase Cloud Database & Single Admin Setup Guide

This guide explains how to set up the **Supabase PostgreSQL** cloud backend for StaffPay.

---

## 1. Create a Free Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and Sign In or Sign Up (Free tier is 100% permanent).
2. Click **New Project**.
3. Fill in:
   - **Name:** `StaffPay` (or any name)
   - **Database Password:** Choose a strong password (save it safely)
   - **Region:** Choose the closest region (e.g. `South Asia (Mumbai)` or nearest)
4. Click **Create new project** and wait ~1-2 minutes for the database to provision.

---

## 2. Run the SQL Database Schema Migration

1. In your Supabase Dashboard, open the **SQL Editor** tab from the left sidebar.
2. Click **+ New Query**.
3. Copy and paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) into the editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. You should see `Success. No rows returned`.
   - This creates all 7 relational tables (`employees`, `attendance`, `leave_types`, `leaves`, `holidays`, `salary_records`, `settings`).
   - Enables Row Level Security (RLS) policies.
   - Adds tables to Supabase Realtime publication for multi-device live sync.

---

## 3. Get Project URL & API Keys

1. In your Supabase Dashboard, click the **Settings** (gear icon) -> **API** (or **Data API**).
2. Find the following values:
   - **Project URL:** e.g. `https://your-project-id.supabase.co`
   - **anon / public key:** e.g. `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. In your project directory, update `.env` and `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

---

## 4. Admin Authentication

StaffPay uses a **Single Admin System** with simple **Username + Password** login:

- When the Admin logs in for the first time with their chosen Username and Password, StaffPay automatically creates and secures their Admin identity in Supabase Auth.
- Any subsequent login from **Chrome, Edge, Firefox, iPhone, Android, or Laptop** with that same Username and Password immediately unlocks all cloud data.
- Row Level Security (RLS) ensures only the authenticated Admin can read/write StaffPay company data.

---

## 5. Local Testing & Deployment

### Run Locally:
```bash
npm run dev
```

### Build and Deploy to GitHub Pages:
```bash
npm run build
npm run deploy
```
