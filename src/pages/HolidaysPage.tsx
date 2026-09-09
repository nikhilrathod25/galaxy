import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { HolidayRepository } from '../repositories/holidayRepository';
import { Holiday } from '../types';
import { formatDisplayDate, getTodayDateString } from '../utils/dateUtils';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

const defaultIndianHolidays = [
  { name: 'Republic Day', date: '-01-26', description: 'National Holiday' },
  { name: 'Maha Shivratri', date: '-03-08', description: 'Religious Festival' },
  { name: 'Holi', date: '-03-25', description: 'Festival of Colors' },
  { name: 'Good Friday', date: '-03-29', description: 'Christian Holiday' },
  { name: 'Eid-ul-Fitr', date: '-04-11', description: 'Islamic Festival' },
  { name: 'Independence Day', date: '-08-15', description: 'National Holiday' },
  { name: 'Ganesh Chaturthi', date: '-09-07', description: 'Religious Festival' },
  { name: 'Gandhi Jayanti', date: '-10-02', description: 'National Holiday' },
  { name: 'Dussehra', date: '-10-12', description: 'Vijayadashami' },
  { name: 'Diwali', date: '-11-01', description: 'Festival of Lights' },
  { name: 'Guru Nanak Jayanti', date: '-11-15', description: 'Sikh Festival' },
  { name: 'Christmas', date: '-12-25', description: 'Christmas Day' },
];

export const HolidaysPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);

  const loadHolidays = async () => {
    setIsLoading(true);
    try {
      const data = await HolidayRepository.getByYear(selectedYear);
      setHolidays(data);
    } catch (err) {
      console.error('Error loading holidays:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  const handleOpenAdd = () => {
    setEditingHoliday(null);
    setName('');
    setDate(`${selectedYear}-01-01`);
    setDescription('');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setName(h.name);
    setDate(h.date);
    setDescription(h.description || '');
    setError('');
    setModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Holiday name is required.');
      return;
    }
    if (!date) {
      setError('Date is required.');
      return;
    }

    const year = parseInt(date.split('-')[0], 10);

    try {
      if (editingHoliday && editingHoliday.id) {
        await HolidayRepository.update(editingHoliday.id, {
          name: name.trim(),
          date,
          year,
          description: description.trim(),
        });
      } else {
        await HolidayRepository.create({
          name: name.trim(),
          date,
          year,
          description: description.trim(),
        });
      }
      setModalOpen(false);
      loadHolidays();
    } catch (err: any) {
      setError(err.message || 'Failed to save holiday.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!holidayToDelete || !holidayToDelete.id) return;
    await HolidayRepository.delete(holidayToDelete.id);
    setDeleteConfirmOpen(false);
    setHolidayToDelete(null);
    loadHolidays();
  };

  const handleLoadDefaults = async () => {
    for (const item of defaultIndianHolidays) {
      const fullDate = `${selectedYear}${item.date}`;
      const existing = await HolidayRepository.getByDate(fullDate);
      if (!existing) {
        await HolidayRepository.create({
          name: item.name,
          date: fullDate,
          year: selectedYear,
          description: item.description,
        });
      }
    }
    loadHolidays();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Holiday Calendar</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Configured holidays are automatically excluded from working-day salary deductions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold transition-colors shadow-sm"
            title="Populate standard national & festival holidays for this year"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Load National Holidays</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-orange-300" />
            <span>Add Holiday</span>
          </button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-base font-bold text-slate-800 min-w-[100px] text-center">
            Year {selectedYear}
          </div>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          {holidays.length} Holiday(s) Configured
        </span>
      </div>

      {/* Holiday Table */}
      {holidays.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={`No holidays added for ${selectedYear}`}
          description="Add company holidays or load standard national holidays to exclude them from working-day salary deductions."
          actionLabel="Load National Holidays"
          onAction={handleLoadDefaults}
          secondaryActionLabel="Add Custom Holiday"
          onSecondaryAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Holiday Name</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {holidays.map(h => (
                  <tr key={h.id || h.date} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs border border-orange-200">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-800">{h.name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-bold text-slate-700">
                      {formatDisplayDate(h.date, 'EEEE, dd MMMM yyyy')}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                      {h.description || '—'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(h)}
                          className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Holiday"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHolidayToDelete(h);
                            setDeleteConfirmOpen(true);
                          }}
                          className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete Holiday"
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

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveHoliday} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Holiday Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Diwali Festival"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Holiday Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Festival celebration"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4 text-orange-300" />
              <span>{editingHoliday ? 'Save Changes' : 'Create Holiday'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Holiday"
        message={`Are you sure you want to delete "${holidayToDelete?.name}" (${holidayToDelete?.date})?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
