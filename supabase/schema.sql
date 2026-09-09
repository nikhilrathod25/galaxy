-- ==============================================================================
-- STAFFPAY COMPLETE CLEAN SUPABASE SETUP (SINGLE ADMIN ARCHITECTURE)
-- ==============================================================================

-- 1. DROP EXISTING TABLES & CONSTRAINTS TO START FRESH
DROP TABLE IF EXISTS public.salary_records CASCADE;
DROP TABLE IF EXISTS public.leaves CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.leave_types CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- 2. EMPLOYEES TABLE
CREATE TABLE public.employees (
    id BIGSERIAL PRIMARY KEY,
    employee_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    photo_url TEXT,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT 'General',
    joining_date DATE NOT NULL,
    end_date DATE,
    monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Terminated')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_status ON public.employees(status);

-- 3. ATTENDANCE TABLE
CREATE TABLE public.attendance (
    id TEXT PRIMARY KEY, -- Composite: employee_id_date (e.g. EMP001_2026-09-09)
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Half Day', 'Paid Leave', 'Unpaid Leave', 'Holiday', 'Weekly Off', 'Not Marked')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_emp ON public.attendance(employee_id);

-- 4. LEAVE TYPES TABLE
CREATE TABLE public.leave_types (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LEAVES TABLE
CREATE TABLE public.leaves (
    id BIGSERIAL PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type_id BIGINT REFERENCES public.leave_types(id) ON DELETE SET NULL,
    leave_type_name TEXT NOT NULL DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(4,1) NOT NULL DEFAULT 1,
    reason TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leaves_emp ON public.leaves(employee_id);
CREATE INDEX idx_leaves_dates ON public.leaves(start_date, end_date);

-- 6. HOLIDAYS TABLE
CREATE TABLE public.holidays (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    year INTEGER NOT NULL,
    description TEXT,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holidays_year ON public.holidays(year);

-- 7. SALARY RECORDS TABLE
CREATE TABLE public.salary_records (
    id TEXT PRIMARY KEY, -- Composite: employee_id_year_month (e.g. EMP001_2026_09)
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    calculation_mode TEXT NOT NULL DEFAULT 'working_days',
    calendar_days INTEGER NOT NULL DEFAULT 0,
    effective_working_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    present_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    absent_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    half_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    paid_leave_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    unpaid_leave_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    not_marked_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    daily_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    absent_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    half_day_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    unpaid_leave_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_finalized BOOLEAN NOT NULL DEFAULT TRUE,
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_month ON public.salary_records(year, month);

-- 8. SETTINGS TABLE
CREATE TABLE public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DISABLE ROW LEVEL SECURITY FOR SEAMLESS SINGLE ADMIN ACCESS
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
