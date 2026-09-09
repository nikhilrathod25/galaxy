import React, { useState, useEffect } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { AuthService } from './services/authService';
import { RealtimeService } from './services/realtimeService';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeFormPage } from './pages/EmployeeFormPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { AttendancePage } from './pages/AttendancePage';
import { SalaryPage } from './pages/SalaryPage';
import { HolidaysPage } from './pages/HolidaysPage';
import { ReportsPage } from './pages/ReportsPage';
import { BackupPage } from './pages/BackupPage';
import { SettingsPage } from './pages/SettingsPage';
import { MobileBottomNav } from './components/common/MobileBottomNav';

// Protected layout wrapper
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1. Subscribe to Supabase Realtime multi-device database changes
    const unsubRealtime = RealtimeService.subscribe();

    // 2. Check Supabase Auth Session
    const checkAuth = async () => {
      const user = await AuthService.initialize();
      if (!user) {
        navigate('/login', { replace: true });
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // 3. Listen to auth state changes (e.g. sign out from another tab)
    const { data: authListener } = AuthService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      unsubRealtime();
      authListener?.subscription.unsubscribe();
    };
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    await AuthService.logout();
    navigate('/login');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">Loading StaffPay Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Sidebar for Desktop */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLockApp={handleLogout}
        hasPin={false}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all">
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onLockApp={handleLogout}
          hasPin={false}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 w-full">
          {children}
        </main>
      </div>

      {/* App-Style Mobile Bottom Navigation */}
      <MobileBottomNav onLockApp={handleLogout} hasPin={false} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<LoginPage />} />

        {/* Authenticated Cloud Routes */}
        <Route
          path="/dashboard"
          element={
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          }
        />

        <Route
          path="/employees"
          element={
            <MainLayout>
              <EmployeesPage />
            </MainLayout>
          }
        />
        <Route
          path="/employees/create"
          element={
            <MainLayout>
              <EmployeeFormPage />
            </MainLayout>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <MainLayout>
              <EmployeeDetailPage />
            </MainLayout>
          }
        />
        <Route
          path="/employees/:id/edit"
          element={
            <MainLayout>
              <EmployeeFormPage />
            </MainLayout>
          }
        />

        <Route
          path="/attendance"
          element={
            <MainLayout>
              <AttendancePage />
            </MainLayout>
          }
        />

        <Route
          path="/salary"
          element={
            <MainLayout>
              <SalaryPage />
            </MainLayout>
          }
        />
        <Route
          path="/salary/:employeeId"
          element={
            <MainLayout>
              <SalaryPage />
            </MainLayout>
          }
        />

        <Route
          path="/holidays"
          element={
            <MainLayout>
              <HolidaysPage />
            </MainLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <MainLayout>
              <ReportsPage />
            </MainLayout>
          }
        />

        <Route
          path="/backup"
          element={
            <MainLayout>
              <BackupPage />
            </MainLayout>
          }
        />

        <Route
          path="/settings"
          element={
            <MainLayout>
              <SettingsPage />
            </MainLayout>
          }
        />

        {/* Default Redirect to Dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
