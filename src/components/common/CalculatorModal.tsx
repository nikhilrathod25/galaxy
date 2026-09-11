import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calculator as CalcIcon,
  Delete,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Modal } from './Modal';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [expression, setExpression] = useState<string>('');
  const [result, setResult] = useState<string>('0');
  const [copied, setCopied] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>([]);

  // Safe evaluation
  const calculateResult = useCallback((expr: string): string => {
    if (!expr.trim()) return '0';
    try {
      // Clean expression: replace symbols
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/%/g, '/100');

      // Only allow safe math characters
      if (!/^[0-9+\-*/. ()]+$/.test(sanitized)) {
        return 'Error';
      }

      // eslint-disable-next-line no-new-func
      const evalRes = Function(`'use strict'; return (${sanitized})`)();
      if (typeof evalRes === 'number' && !isNaN(evalRes) && isFinite(evalRes)) {
        // Round cleanly to max 4 decimals if needed
        return String(Math.round(evalRes * 10000) / 10000);
      }
      return '0';
    } catch {
      return '';
    }
  }, []);

  const handleInput = useCallback((char: string) => {
    setExpression(prev => {
      const next = prev + char;
      const res = calculateResult(next);
      if (res && res !== 'Error') setResult(res);
      return next;
    });
  }, [calculateResult]);

  const handleClear = () => {
    setExpression('');
    setResult('0');
  };

  const handleBackspace = () => {
    setExpression(prev => {
      const next = prev.slice(0, -1);
      if (!next) {
        setResult('0');
      } else {
        const res = calculateResult(next);
        if (res && res !== 'Error') setResult(res);
      }
      return next;
    });
  };

  const handleEquals = () => {
    if (!expression.trim()) return;
    const finalRes = calculateResult(expression);
    if (finalRes && finalRes !== 'Error') {
      setHistory(prev => [`${expression} = ${finalRes}`, ...prev.slice(0, 9)]);
      setExpression(finalRes);
      setResult(finalRes);
    }
  };

  const handleCopy = () => {
    const textToCopy = result !== '0' ? result : expression || '0';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      } else if (['+', '-', '*', '/'].includes(e.key)) {
        const symbol = e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key === '-' ? '−' : '+';
        handleInput(` ${symbol} `);
      } else if (e.key === '.' || e.key === '%') {
        handleInput(e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleInput, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xs sm:max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <CalcIcon className="w-4 h-4 text-orange-300" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">StaffPay Calculator</h3>
              <p className="text-[10px] text-blue-200 font-medium">Quick Payroll & Math Calculations</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-4 bg-slate-900 text-white flex flex-col justify-end min-h-[105px] border-b border-slate-800 relative select-text">
          {/* Formula Line */}
          <div className="text-right text-xs font-mono text-slate-400 truncate min-h-[18px]">
            {expression || ' '}
          </div>

          {/* Big Result Line */}
          <div className="text-right text-2xl sm:text-3xl font-black font-mono tracking-tight text-white truncate mt-1">
            {result}
          </div>

          {/* Quick Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="absolute left-3 bottom-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
            title="Copy Result"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Keypad Grid */}
        <div className="p-3 sm:p-4 bg-slate-50 grid grid-cols-4 gap-2 select-none">
          {/* Row 1 */}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-sm transition cursor-pointer active:scale-95 shadow-2xs"
          >
            AC
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 rounded-2xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center transition cursor-pointer active:scale-95 shadow-2xs"
            title="Backspace"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInput('%')}
            className="py-3 rounded-2xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-black text-sm transition cursor-pointer active:scale-95 shadow-2xs"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleInput(' ÷ ')}
            className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base transition cursor-pointer active:scale-95 shadow-xs shadow-blue-600/20"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => handleInput('7')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleInput('8')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleInput('9')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleInput(' × ')}
            className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base transition cursor-pointer active:scale-95 shadow-xs shadow-blue-600/20"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            type="button"
            onClick={() => handleInput('4')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleInput('5')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleInput('6')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleInput(' − ')}
            className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base transition cursor-pointer active:scale-95 shadow-xs shadow-blue-600/20"
          >
            −
          </button>

          {/* Row 4 */}
          <button
            type="button"
            onClick={() => handleInput('1')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleInput('2')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleInput('3')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleInput(' + ')}
            className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base transition cursor-pointer active:scale-95 shadow-xs shadow-blue-600/20"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => handleInput('0')}
            className="col-span-2 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleInput('.')}
            className="py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 font-black text-base transition cursor-pointer active:scale-95 shadow-2xs"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg transition cursor-pointer active:scale-95 shadow-md shadow-orange-500/25"
          >
            =
          </button>
        </div>

        {/* Recent History Drawer */}
        {history.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-100/90 border-t border-slate-200 text-xs flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold text-slate-500 truncate">
              Recent: {history[0]}
            </span>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[10px] text-slate-400 hover:text-slate-700 font-bold shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
