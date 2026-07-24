
import React, { useState, useRef } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, MarketingDesignConfig, MarketingHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw } from 'lucide-react';

interface MarketingDesignToolProps {
  t: any;
}

const MarketingDesignTool: React.FC<MarketingDesignToolProps> = ({ t }) => {
  const [mainImage, setMainImage] = useState<{file: File, base64: string} | null>(null);
  const [additionalImages, setAdditionalImages] = useState<{id: string, file: File, base64: string}[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');

  // History State
  const [history, setHistory] = useState<MarketingHistoryItem[]>([]);

  // Config State
  const [config, setConfig] = useState<MarketingDesignConfig>({
    materialType: 'Poster',
    width: '29.7cm',
    height: '42cm',
    industry: 'food',
    style: 'modern',
    primaryColor: '#FF5733',
    fontStyle: 'Modern Sans-Serif',
    adContent: '',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  // Handle Material Change and Auto-set Dimensions
  const handleMaterialChange = (type: 'Poster' | 'Flyer' | 'Banner' | 'Pano') => {
      let w = '', h = '';
      switch(type) {
          case 'Poster': w = '29.7cm'; h = '42cm'; break;
          case 'Flyer': w = '14.8cm'; h = '21cm'; break;
          case 'Banner': w = '1080px'; h = '1920px'; break;
          case 'Pano': w = '2m'; h = '4m'; break;
      }
      setConfig(prev => ({ ...prev, materialType: type, width: w, height: h }));
  };

  const handleAdditionalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files);
          newFiles.forEach((file) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  setAdditionalImages(prev => [...prev, {
                      id: Math.random().toString(36).substr(2, 9),
                      file: file as File,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file as Blob);
          });
      }
  };

  const removeAdditionalImage = (id: string) => {
      setAdditionalImages(prev => prev.filter(img => img.id !== id));
  };

  const handleProcess = async () => {
    if (!mainImage) return;
    setLoading(true); setError(null);
    try {
        const output = await processImage(
            ToolType.MARKETING_DESIGN,
            mainImage.base64,
            mainImage.file.type,
            config.customPrompt,
            config,
            additionalImages.map(img => img.base64) // Pass array of base64 strings
        );
        
        // Save history
        const newItem: MarketingHistoryItem = {
            id: Date.now().toString(),
            originalImage: mainImage.base64,
            additionalImages: additionalImages.map(img => img.base64),
            resultImage: output,
            config: { ...config },
            timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev]);
        setResult(output);
        setRefinePrompt('');
    } catch (err: any) {
        setError(err.message || t.common.error);
    } finally {
        setLoading(false);
    }
  };

  const handleRefine = () => {
    if (!refinePrompt.trim() || !mainImage) return;
    
    const updatedPrompt = `${config.customPrompt} \n\n Refinement Request: ${refinePrompt}`;
    setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));

    setLoading(true); setError(null);
    (async () => {
      try {
        const output = await processImage(
          ToolType.MARKETING_DESIGN,
          mainImage.base64,
          mainImage.file.type,
          updatedPrompt, 
          { ...config, customPrompt: updatedPrompt },
          additionalImages.map(img => img.base64)
        );
        setResult(output);
      } catch (err: any) {
        setError(err.message || t.common.error);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleReset = () => {
      setMainImage(null);
      setAdditionalImages([]);
      setResult(null);
      setRefinePrompt('');
      setConfig(prev => ({...prev, adContent: '', customPrompt: ''}));
  };

  const handleRestore = (item: MarketingHistoryItem) => {
      setMainImage({ file: new File([], "restored"), base64: item.originalImage });
      // Reconstruct additional images struct
      setAdditionalImages(item.additionalImages.map(b64 => ({
          id: Math.random().toString(),
          file: new File([], "asset"),
          base64: b64
      })));
      setConfig(item.config);
      setResult(item.resultImage);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={t.marketingDesign.loading} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.marketingDesign.panelTitle}
            </h3>

            {/* Material & Dimensions */}
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.materialLabel}</label>
                    <select 
                        value={config.materialType}
                        onChange={(e) => handleMaterialChange(e.target.value as any)}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                    >
                        {Object.entries(t.marketingDesign.materials).map(([key, label]) => (
                            <option key={key} value={key.charAt(0).toUpperCase() + key.slice(1)}>{label as string}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.sizeLabel}</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" value={config.width}
                            onChange={(e) => setConfig({...config, width: e.target.value})}
                            className="w-1/2 p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                        />
                        <input 
                            type="text" value={config.height}
                            onChange={(e) => setConfig({...config, height: e.target.value})}
                            className="w-1/2 p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Industry & Style */}
            <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.industryLabel}</label>
                    <select 
                        value={config.industry}
                        onChange={(e) => setConfig({...config, industry: e.target.value})}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    >
                        {Object.entries(t.marketingDesign.industries).map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.styleLabel}</label>
                    <select 
                        value={config.style}
                        onChange={(e) => setConfig({...config, style: e.target.value})}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    >
                         {Object.entries(t.marketingDesign.styles).map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                 </div>
            </div>

            {/* Color */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.colorLabel}</label>
                <div className="flex gap-2">
                      <input type="color" value={config.primaryColor} onChange={(e) => setConfig({...config, primaryColor: e.target.value})} className="h-9 w-9 p-0 border-0 rounded cursor-pointer" />
                      <input type="text" value={config.primaryColor} onChange={(e) => setConfig({...config, primaryColor: e.target.value})} className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.contentLabel}</label>
                <input 
                    type="text" 
                    placeholder="Font (e.g. Arial, Roboto)"
                    value={config.fontStyle}
                    onChange={(e) => setConfig({...config, fontStyle: e.target.value})}
                    className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 mb-1"
                />
                <textarea 
                    value={config.adContent}
                    onChange={(e) => setConfig({...config, adContent: e.target.value})}
                    placeholder={t.marketingDesign.contentPlaceholder}
                    className="w-full p-3 h-20 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* Quality & Prompt */}
            <div className="space-y-3">
                 <div className="flex gap-2">
                    <select 
                        value={config.upscale}
                        onChange={(e) => setConfig({...config, upscale: e.target.value as any})}
                        className="flex-1 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    >
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">{t.marketingDesign.promptLabel}</label>
                     <textarea 
                        value={config.customPrompt}
                        onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                        placeholder={t.marketingDesign.promptPlaceholder}
                        className="w-full p-2 h-16 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                    />
                 </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={!mainImage || loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-base"
                >
                    {t.marketingDesign.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.marketingDesign.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.marketingDesign.btnExit}
                     </button>
                </div>
            </div>

            {/* History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.marketingDesign.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.resultImage} className="w-10 h-10 object-cover rounded" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{item.config.materialType}</div>
                                <div className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</div>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => handleRestore(item)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                        <RotateCcw size={10} /> Restore
                                    </button>
                                    <button onClick={() => handleDeleteHistory(item.id)} className="text-[10px] text-red-600 hover:underline flex items-center gap-1">
                                        <Trash2 size={10} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-xs text-slate-400 italic">Trống</p>}
                </div>
            </div>
       </div>

       {/* --- CENTER: INPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">Before (Input Area)</div>
          <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 overflow-y-auto">
              
              {/* Main Image */}
              <div className="flex-1 flex flex-col min-h-[300px] mb-4">
                  <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{t.marketingDesign.mainImageLabel}</label>
                  {mainImage ? (
                      <div className="relative flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img src={mainImage.base64} className="max-w-full max-h-full object-contain p-2" />
                          <button onClick={() => setMainImage(null)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                              <Trash2 size={14} />
                          </button>
                      </div>
                  ) : (
                      <div className="flex-1">
                          <ImageUploader onImageSelect={(file, base64) => setMainImage({file, base64})} previewUrl={null} t={t} />
                      </div>
                  )}
              </div>

              {/* Additional Assets */}
              <div className="mt-auto">
                  <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                     <Plus size={16} /> {t.marketingDesign.addAssets}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                      {additionalImages.map(img => (
                          <div key={img.id} className="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 group">
                              <img src={img.base64} className="w-full h-full object-cover" />
                              <button onClick={() => removeAdditionalImage(img.id)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      ))}
                      <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <Plus size={24} className="text-slate-400" />
                          <input type="file" multiple accept="image/*" className="hidden" onChange={handleAdditionalUpload} />
                      </label>
                  </div>
              </div>
          </div>
       </div>

       {/* --- RIGHT: OUTPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">After (Output Area)</div>
          <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
             {result ? (
                 <div className="w-full h-full flex flex-col">
                     <div className="flex-1 p-4 flex items-center justify-center bg-white dark:bg-slate-900/50 overflow-hidden">
                         <img src={result} className="w-full h-full object-contain shadow-2xl" />
                     </div>
                     <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                         {/* Refine */}
                         <div className="flex gap-2">
                             <input 
                                type="text"
                                value={refinePrompt}
                                onChange={(e) => setRefinePrompt(e.target.value)}
                                placeholder={t.marketingDesign.refinePlaceholder}
                                className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                             />
                             <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                 <Send size={16} />
                             </button>
                         </div>
                         <a href={result} download={`marketing_${config.materialType}.png`} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                             <Download size={18} /> {t.marketingDesign.download}
                         </a>
                     </div>
                 </div>
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-400">
                     <p>{t.marketingDesign.emptyOutput}</p>
                 </div>
             )}
          </div>
       </div>

       {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default MarketingDesignTool;
