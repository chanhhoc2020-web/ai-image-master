
import React, { useState, useEffect } from 'react';
import { ToolType, Language } from './types';
import { translations } from './translations';
import Header from './components/Header';
import RecolorTool from './components/RecolorTool';
import RemoveBgTool from './components/RemoveBgTool';
import IdPhotoTool from './components/IdPhotoTool';
import ChangeAccessoryTool from './components/ChangeAccessoryTool';
import RestorationTool from './components/RestorationTool';
import ObjectEditingTool from './components/ObjectEditingTool';
import VectorConversionTool from './components/VectorConversionTool';
import AdvancedRecolorTool from './components/AdvancedRecolorTool';
import MarketingDesignTool from './components/MarketingDesignTool';
import PortraitEditingTool from './components/PortraitEditingTool';
import LogoDesignTool from './components/LogoDesignTool';
import ThumbnailDesignTool from './components/ThumbnailDesignTool';
import ProductLabelTool from './components/ProductLabelTool';
import InvitationDesignTool from './components/InvitationDesignTool';
import ImageResizerTool from './components/ImageResizerTool';
import TextToImageTool from './components/TextToImageTool';
import BeforeAfterTool from './components/BeforeAfterTool';
import ComponentGenerationTool from './components/ComponentGenerationTool';
import ApiKeyModal from './components/ApiKeyModal';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.ID_PHOTO);
  const [language, setLanguage] = useState<Language>('vi');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check local storage or system preference on init
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // API Key State
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => {
      return !!localStorage.getItem('hf_api_key');
  });

  // Derived translation object
  const t = translations[language];

  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleSaveApiKey = (key: string) => {
      localStorage.setItem('hf_api_key', key);
      setHasApiKey(true);
  };

  const handleResetApiKey = () => {
      localStorage.removeItem('hf_api_key');
      setHasApiKey(false);
  };

  const renderTool = () => {
    switch (activeTool) {
      case ToolType.RECOLOR:
        return <RecolorTool t={t} />;
      case ToolType.REMOVE_BG:
        return <RemoveBgTool t={t} />;
      case ToolType.ID_PHOTO:
        return <IdPhotoTool t={t} />;
      case ToolType.CHANGE_ACCESSORY:
        return <ChangeAccessoryTool t={t} />;
      case ToolType.RESTORATION:
        return <RestorationTool t={t} />;
      case ToolType.OBJECT_EDITING:
        return <ObjectEditingTool t={t} />;
      case ToolType.VECTOR_CONVERSION:
        return <VectorConversionTool t={t} />;
      case ToolType.ADVANCED_RECOLOR:
        return <AdvancedRecolorTool t={t} />;
      case ToolType.MARKETING_DESIGN:
        return <MarketingDesignTool t={t} />;
      case ToolType.PORTRAIT_EDITING:
        return <PortraitEditingTool t={t} />;
      case ToolType.LOGO_DESIGN:
        return <LogoDesignTool t={t} />;
      case ToolType.THUMBNAIL_DESIGN:
        return <ThumbnailDesignTool t={t} lang={language} />;
      case ToolType.PRODUCT_LABEL:
        return <ProductLabelTool t={t} />;
      case ToolType.INVITATION_DESIGN:
        return <InvitationDesignTool t={t} />;
      case ToolType.IMAGE_RESIZER:
        return <ImageResizerTool t={t} />;
      case ToolType.TEXT_TO_IMAGE:
        return <TextToImageTool t={t} />;
      case ToolType.BEFORE_AFTER:
        return <BeforeAfterTool t={t} />;
      case ToolType.COMPONENT_GENERATION:
        return <ComponentGenerationTool t={t} />;
      default:
        return <IdPhotoTool t={t} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {!hasApiKey && <ApiKeyModal onSave={handleSaveApiKey} />}
      
      <Header 
        isDarkMode={isDarkMode} 
        toggleTheme={toggleTheme} 
        language={language}
        setLanguage={setLanguage}
        t={t}
        onResetApiKey={handleResetApiKey}
      />
      
      <main className="flex-grow container mx-auto px-4 py-8 max-w-[1400px]">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden mb-8 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div className="p-4 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="bg-blue-600 w-1 h-6 rounded-full"></span>
              {t.app.selectToolTitle}
            </h2>
            <div className="relative">
                <select 
                value={activeTool}
                onChange={(e) => setActiveTool(e.target.value as ToolType)}
                className="w-full sm:w-80 p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer font-medium"
                >
                <option value={ToolType.RECOLOR}>{t.app.tools.recolor}</option>
                <option value={ToolType.REMOVE_BG}>{t.app.tools.removeBg}</option>
                <option value={ToolType.ID_PHOTO}>{t.app.tools.idPhoto}</option>
                <option value={ToolType.CHANGE_ACCESSORY}>{t.app.tools.accessory}</option>
                <option value={ToolType.RESTORATION}>{t.app.tools.restoration}</option>
                <option value={ToolType.OBJECT_EDITING}>{t.app.tools.objectEditing}</option>
                <option value={ToolType.VECTOR_CONVERSION}>{t.app.tools.vector}</option>
                <option value={ToolType.ADVANCED_RECOLOR}>{t.app.tools.advancedRecolor}</option>
                <option value={ToolType.MARKETING_DESIGN}>{t.app.tools.marketingDesign}</option>
                <option value={ToolType.PORTRAIT_EDITING}>{t.app.tools.portraitEditing}</option>
                <option value={ToolType.LOGO_DESIGN}>{t.app.tools.logoDesign}</option>
                <option value={ToolType.THUMBNAIL_DESIGN}>{t.app.tools.thumbnailDesign}</option>
                <option value={ToolType.PRODUCT_LABEL}>{t.app.tools.productLabel}</option>
                <option value={ToolType.INVITATION_DESIGN}>{t.app.tools.invitationDesign}</option>
                <option value={ToolType.IMAGE_RESIZER}>{t.app.tools.imageResizer}</option>
                <option value={ToolType.TEXT_TO_IMAGE}>{t.app.tools.textToImage}</option>
                <option value={ToolType.BEFORE_AFTER}>{t.app.tools.beforeAfter}</option>
                <option value={ToolType.COMPONENT_GENERATION}>{t.app.tools.componentGeneration}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-white dark:bg-slate-900 transition-colors duration-300">
            {renderTool()}
          </div>
        </div>

        <footer className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">
          {t.app.footer}
        </footer>
      </main>
    </div>
  );
};

export default App;
