import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Download,
  Users,
  Phone,
  Mail,
  Calendar,
  Building2,
  Eye,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { CSVService } from '../services/csvService';
import { Employee, EmployeeStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatINR } from '../utils/currencyUtils';
import { formatDisplayDate } from '../utils/dateUtils';

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | EmployeeStatus>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Delete dialog states
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await EmployeeRepository.getAll();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();

    const handleDataUpdate = () => {
      loadEmployees();
    };

    window.addEventListener('staffpay_database_updated', handleDataUpdate);
    return () => {
      window.removeEventListener('staffpay_database_updated', handleDataUpdate);
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp => {
      const matchesSearch =
        !q ||
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  const handleExportCSV = () => {
    CSVService.exportEmployees(filteredEmployees);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete || !employeeToDelete.id) return;
    setIsDeleting(true);
    try {
      await EmployeeRepository.delete(employeeToDelete.id);
      setEmployeeToDelete(null);
      await loadEmployees();
    } catch (err: any) {
      alert(`Failed to delete employee: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Employees Roster</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Manage your staff profiles, designations, joining dates, and monthly compensation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {employees.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Export CSV</span>
            </button>
          )}

          <Link
            to="/employees/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4 text-orange-300" />
            <span>Add Employee</span>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, phone, designation..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="All">All Statuses ({employees.length})</option>
            <option value="Active">Active ({employees.filter(e => e.status === 'Active').length})</option>
            <option value="Inactive">Inactive ({employees.filter(e => e.status === 'Inactive').length})</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={employees.length === 0 ? 'No employees registered yet' : 'No matching employees'}
          description={
            employees.length === 0
              ? 'Get started by adding your first employee to track attendance and calculate monthly salaries.'
              : 'Try adjusting your search query or status filter.'
          }
          actionLabel={employees.length === 0 ? 'Add First Employee' : undefined}
          onAction={() => (window.location.href = '#/employees/create')}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 min-w-[240px] whitespace-nowrap">Employee</th>
                  <th className="px-6 py-4 min-w-[180px] whitespace-nowrap">Contact</th>
                  <th className="px-6 py-4 min-w-[160px] whitespace-nowrap">Joining Date</th>
                  <th className="px-6 py-4 min-w-[150px] whitespace-nowrap">Monthly Salary</th>
                  <th className="px-6 py-4 min-w-[120px] whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 min-w-[140px] text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(emp => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm border border-blue-100 shrink-0">
                            {emp.fullName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 whitespace-nowrap">{emp.fullName}</div>
                          <div className="text-xs text-slate-400 font-mono flex items-center gap-2 whitespace-nowrap">
                            <span className="text-blue-600 font-bold">{emp.employeeId}</span>
                            <span>•</span>
                            <span className="text-slate-500 font-sans">{emp.designation}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-0.5 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{emp.phone || '—'}</span>
                        </div>
                        {emp.email && (
                          <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{emp.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-600 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDisplayDate(emp.joiningDate, 'dd MMM yyyy')}</span>
                      </div>
                      {emp.endDate && (
                        <span className="text-[11px] text-rose-500 block mt-0.5 font-semibold whitespace-nowrap">
                          Left {formatDisplayDate(emp.endDate, 'dd MMM yyyy')}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                      {formatINR(emp.monthlySalary)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={emp.status} size="sm" />
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/employees/${emp.id}`}
                          className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Profile & Attendance History"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/employees/${emp.id}/edit`}
                          className="p-2 rounded-xl text-orange-600 hover:bg-orange-50 transition-colors"
                          title="Edit Employee Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEmployeeToDelete(emp)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(employeeToDelete)}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Employee"
        message={`Are you sure you want to permanently delete ${employeeToDelete?.fullName} (${employeeToDelete?.employeeId})? This action cannot be undone.`}
        confirmLabel="Yes, Delete Employee"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
