-- ==============================================================================
-- STAFFPAY POSTGRESQL SCHEMA FOR SUPABASE
-- Complete Single Admin Cloud Architecture with Row-Level Security (RLS) & Realtime
-- ==============================================================================

-- 1. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    employee_id TEXT NOT NULL,
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_employee_id UNIQUE (user_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

-- 2. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT NOT NULL, -- Composite: employee_id_date (e.g. EMP001_2026-09-09)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Half Day', 'Paid Leave', 'Unpaid Leave', 'Holiday', 'Weekly Off', 'Not Marked')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_emp ON public.attendance(user_id, employee_id);

-- 3. LEAVE TYPES TABLE
CREATE TABLE IF NOT EXISTS public.leave_types (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_leave_type_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_user ON public.leave_types(user_id);

-- 4. LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.leaves (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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

CREATE INDEX IF NOT EXISTS idx_leaves_user_emp ON public.leaves(user_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON public.leaves(user_id, start_date, end_date);

-- 5. HOLIDAYS TABLE
CREATE TABLE IF NOT EXISTS public.holidays (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_holiday_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_user_year ON public.holidays(user_id, year);

-- 6. SALARY RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.salary_records (
    id TEXT NOT NULL, -- Composite: employee_id_year_month (e.g. EMP001_2026_09)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_salary_user_month ON public.salary_records(user_id, year, month);

-- 7. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Employees policies
DROP POLICY IF EXISTS "Admin manages own employees" ON public.employees;
CREATE POLICY "Admin manages own employees" ON public.employees
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attendance policies
DROP POLICY IF EXISTS "Admin manages own attendance" ON public.attendance;
CREATE POLICY "Admin manages own attendance" ON public.attendance
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leave Types policies
DROP POLICY IF EXISTS "Admin manages own leave_types" ON public.leave_types;
CREATE POLICY "Admin manages own leave_types" ON public.leave_types
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leaves policies
DROP POLICY IF EXISTS "Admin manages own leaves" ON public.leaves;
CREATE POLICY "Admin manages own leaves" ON public.leaves
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Holidays policies
DROP POLICY IF EXISTS "Admin manages own holidays" ON public.holidays;
CREATE POLICY "Admin manages own holidays" ON public.holidays
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Salary Records policies
DROP POLICY IF EXISTS "Admin manages own salary_records" ON public.salary_records;
CREATE POLICY "Admin manages own salary_records" ON public.salary_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Settings policies
DROP POLICY IF EXISTS "Admin manages own settings" ON public.settings;
CREATE POLICY "Admin manages own settings" ON public.settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- SUPABASE REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
