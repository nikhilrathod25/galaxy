import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-slate-200/70 rounded-xl w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="h-12 w-12 bg-slate-200/70 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200/70 rounded-md w-3/4" />
            <div className="h-3 bg-slate-100 rounded-md w-1/2" />
          </div>
          <div className="h-8 bg-slate-200/70 rounded-lg w-24" />
        </div>
      ))}
    </div>
  );
};
