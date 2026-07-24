
import React from 'react';

interface LoadingOverlayProps {
  message: string;
  t?: any;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, t }) => {
  const title = t?.common?.loadingTitle || "Phần mềm đang xử lý";

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-300 border border-slate-100 dark:border-slate-700">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 border-4 border-blue-100 dark:border-slate-600 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 dark:border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <svg className="w-8 h-8 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
             </svg>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{message}</p>
        </div>
        <div className="flex gap-1 justify-center">
          <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-500 rounded-full animate-bounce delay-75"></div>
          <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-500 rounded-full animate-bounce delay-150"></div>
          <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-500 rounded-full animate-bounce delay-300"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
