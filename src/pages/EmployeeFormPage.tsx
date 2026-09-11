import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  IndianRupee,
  CheckCircle2,
  X,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { compressImage } from '../services/imageService';
import { Employee, EmployeeStatus } from '../types';
import { getTodayDateString } from '../utils/dateUtils';

export const EmployeeFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState('');
  const [monthlySalary, setMonthlySalary] = useState<number>(30000);
  const [overtimeRate, setOvertimeRate] = useState<string>('');
  const [status, setStatus] = useState<EmployeeStatus>('Active');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialize = async () => {
      if (isEditing && id) {
        const emp = await EmployeeRepository.getById(parseInt(id, 10));
        if (emp) {
          setEmployeeId(emp.employeeId);
          setFullName(emp.fullName);
          setDesignation(emp.designation);
          setPhone(emp.phone);
          setEmail(emp.email);
          setAddress(emp.address);
          setJoiningDate(emp.joiningDate);
          setEndDate(emp.endDate || '');
          setMonthlySalary(emp.monthlySalary);
          setOvertimeRate(emp.overtimeRate !== undefined && emp.overtimeRate > 0 ? String(emp.overtimeRate) : '');
          setStatus(emp.status);
          setNotes(emp.notes || '');
          setPhotoUrl(emp.photoUrl);
        } else {
          setError('Employee not found');
        }
      } else {
        // Auto-generate stable next ID
        const nextId = await EmployeeRepository.generateNextEmployeeId();
        setEmployeeId(nextId);
      }
    };
    initialize();
  }, [id, isEditing]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress to 300x300 JPEG
      const compressed = await compressImage(file, 300, 300, 0.8);
      setPhotoUrl(compressed);
    } catch (err) {
      console.error('Photo compression error:', err);
      setError('Failed to process image file.');
    }
  };

  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedName = capitalizeWords(fullName.trim());
    const formattedDesignation = capitalizeWords(designation.trim());

    if (!formattedName) {
      setError('Full Name is required.');
      return;
    }
    if (!employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (isNaN(monthlySalary) || monthlySalary < 0) {
      setError('Please enter a valid monthly salary.');
      return;
    }

    setIsSubmitting(true);
    try {
      const otRateNum = overtimeRate ? parseFloat(overtimeRate) : undefined;
      if (isEditing && id) {
        await EmployeeRepository.update(parseInt(id, 10), {
          employeeId,
          fullName: formattedName,
          designation: formattedDesignation,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          joiningDate,
          endDate: endDate ? endDate : undefined,
          monthlySalary: Number(monthlySalary),
          overtimeRate: otRateNum && !isNaN(otRateNum) && otRateNum > 0 ? otRateNum : undefined,
          status,
          notes: notes.trim(),
          photoUrl,
        });
        navigate(`/employees/${id}`);
      } else {
        const newId = await EmployeeRepository.create({
          employeeId: employeeId.trim().toUpperCase(),
          fullName: formattedName,
          designation: formattedDesignation,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          joiningDate,
          endDate: endDate ? endDate : undefined,
          monthlySalary: Number(monthlySalary),
          overtimeRate: otRateNum && !isNaN(otRateNum) && otRateNum > 0 ? otRateNum : undefined,
          status,
          notes: notes.trim(),
          photoUrl,
        });
        navigate(`/employees/${newId}`);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={isEditing ? `/employees/${id}` : '/employees'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditing ? 'Edit Employee Details' : 'Add New Employee'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {isEditing
              ? 'Update compensation, contact details, or employment status'
              : 'Add an employee to track attendance and generate salary slips'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Form in Full Width Clean Light Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 w-full"
      >
        {/* Photo & Employee ID banner */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="relative">
            {photoUrl ? (
              <div className="relative group">
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-300 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(undefined)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
                  title="Remove Photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-300 flex flex-col items-center justify-center text-blue-400">
                <User className="w-8 h-8 text-blue-500" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold cursor-pointer shadow-xs transition-colors">
                <Upload className="w-3.5 h-3.5 text-orange-500" />
                <span>Upload Profile Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Photos are compressed on-device to keep IndexedDB lean and fast.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Employee ID
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value.toUpperCase())}
              className="w-28 text-center px-3 py-2 text-sm font-mono font-bold text-blue-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </div>

        {/* Primary Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(capitalizeWords(e.target.value))}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium capitalize"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Designation / Role <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={designation}
              onChange={e => setDesignation(capitalizeWords(e.target.value))}
              placeholder="e.g. Senior Software Engineer"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium capitalize"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Residential Address
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="e.g. Flat 101, Galaxy Enclave, Sector 15"
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Employment & Salary Details in Blue/Orange */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
          <div>
            <label className="block text-xs font-bold text-blue-950 mb-1.5">
              Monthly Base Salary (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-orange-500">
                ₹
              </span>
              <input
                type="number"
                required
                min="0"
                step="100"
                value={monthlySalary}
                onChange={e => setMonthlySalary(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-4 py-2.5 text-sm font-black text-blue-900 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-950 mb-1.5">
              Overtime Rate (₹ / Hour)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-orange-500">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="10"
                placeholder="Auto (Salary ÷ 8h)"
                value={overtimeRate}
                onChange={e => setOvertimeRate(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 text-sm font-black text-blue-900 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <p className="text-[10px] text-blue-700/80 mt-1 font-medium">
              Optional (Tarika 1: Custom ₹/hr)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-950 mb-1.5">
              Joining Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={joiningDate}
              onChange={e => setJoiningDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-semibold bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-950 mb-1.5">
              End / Exit Date (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-semibold bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status and Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Employment Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as EmployeeStatus)}
              className="w-full px-3 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="Active">Active (Working)</option>
              <option value="Inactive">Inactive (On Leave / Resigned)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notes & Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Handles enterprise accounts, probation completed."
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            to={isEditing ? `/employees/${id}` : '/employees'}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-orange-300" />
            <span>{isSubmitting ? 'Saving Employee...' : isEditing ? 'Save Changes' : 'Create Employee'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
