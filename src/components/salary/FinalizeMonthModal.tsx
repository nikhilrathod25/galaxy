import React, { useState } from 'react';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { formatMonthYear } from '../../utils/dateUtils';

interface FinalizeMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  totalEmployees: number;
  onConfirmFinalize: (notes?: string) => Promise<void>;
}

export const FinalizeMonthModal: React.FC<FinalizeMonthModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  totalEmployees,
  onConfirmFinalize,
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthYearStr = formatMonthYear(year, month);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmFinalize(notes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Finalize Salary Snapshot — ${monthYearStr}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900">
          <Lock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed font-medium">
            <p className="font-bold mb-1 text-blue-950">Snapshot Finalization</p>
            Finalizing will generate permanent salary records for {totalEmployees} employee(s)
            for {monthYearStr}. Historical records remain safely stored in IndexedDB and backup files.
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Optional Closing Note:
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g., September payroll finalized after client billing approval."
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all shadow-md shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Finalizing...' : 'Finalize & Lock Snapshot'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
