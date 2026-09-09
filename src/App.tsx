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
import { AccountService } from './services/accountService';
import { CloudSyncService } from './services/cloudSyncService';
import { MigrationModal } from './components/cloud/MigrationModal';
import { MigrationState } from './types/cloud';

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
  const [hasPin, setHasPin] = useState(false);
  const [migrationState, setMigrationState] = useState<MigrationState>(CloudSyncService.getMigrationState());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubMigration = CloudSyncService.subscribeMigration((state) => {
      setMigrationState({ ...state });
    });

    const checkAuth = async () => {
      // 1. StaffPay Account Authentication Check
      if (!AccountService.isAuthenticated()) {
        navigate('/login', { replace: true });
        return;
      }

      // 2. Initialize Cloud Sync for current Account
      CloudSyncService.initialize().catch((err) => {
        console.warn('Initial cloud sync notice:', err);
      });

      // 3. Local PIN Lock Check
      const pinSet = await AuthService.isPinSet();
      setHasPin(pinSet);

      if (pinSet && !AuthService.isSessionUnlocked()) {
        navigate('/login', { replace: true });
      }
    };

    checkAuth();

    return () => {
      unsubMigration();
    };
  }, [location.pathname, navigate]);

  const handleLockApp = () => {
    AuthService.lockSession();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Sidebar for Desktop */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLockApp={handleLockApp}
        hasPin={hasPin}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all">
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onLockApp={handleLockApp}
          hasPin={hasPin}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 w-full">
          {children}
        </main>
      </div>

      {/* App-Style Mobile Bottom Navigation */}
      <MobileBottomNav onLockApp={handleLockApp} hasPin={hasPin} />

      {/* Interactive First-Time Migration Modal (Case A & Case B) */}
      {migrationState.isOpen && migrationState.type && (
        <MigrationModal
          type={migrationState.type}
          onComplete={() => {
            setMigrationState({ isOpen: false, type: null, pendingCloudDb: null });
          }}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Login / Register */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<LoginPage />} />

        {/* Authenticated Routes with Sidebar & Navbar Layout */}
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
