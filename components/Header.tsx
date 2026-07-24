
import React from 'react';
import { Language } from '../types';
import { Key } from 'lucide-react';

interface HeaderProps {
    isDarkMode: boolean;
    toggleTheme: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: any;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleTheme, language, setLanguage, t }) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors duration-300">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
            N
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{t.header.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.header.subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
            


            {/* Language Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'vi' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    VN
                </button>
                <button 
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    EN
                </button>
            </div>

            {/* Theme Toggle Button */}
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={t.header.themeTitle}
            >
                {isDarkMode ? (
                    // Sun Icon for Dark Mode
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    // Moon Icon for Light Mode
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
            </button>


        </div>
      </div>
    </header>
  );
};

export default Header;
