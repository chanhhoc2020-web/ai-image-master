import React, { useState, useRef } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, VectorConfig, VectorStyle, VectorHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { RefreshCcw, LogOut, ArrowRight, Trash2, RotateCcw, Download, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface VectorConversionToolProps {
  t: any;
}

const VectorConversionTool: React.FC<VectorConversionToolProps> = ({ t }) => {
  const [image, setImage] = useState<{file: File, base64: string} | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState<VectorConfig>({
    style: 'flat',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [history, setHistory] = useState<VectorHistoryItem[]>([]);

  const handleProcess = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const output = await processImage(
        ToolType.VECTOR_CONVERSION,
        image.base64,
        image.file.type,
        config.customPrompt,
        config
      );
      
      const newHistoryItem: VectorHistoryItem = {
        id: Date.now().toString(),
        originalImage: image.base64,
        resultImage: output,
        config: { ...config },
        timestamp: Date.now()
      };
      
      setHistory(prev => [newHistoryItem, ...prev]);
      setResult(output);
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setConfig({
        style: 'flat',
        quality: 'keep_original',
        upscale: 'x1',
        customPrompt: ''
    });
  };

  const handleRestore = (item: VectorHistoryItem) => {
      // Create a dummy file object for consistency, though we mainly use base64 for display
      setImage({ file: new File([], "restored"), base64: item.originalImage });
      setConfig(item.config);
      setResult(item.resultImage);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(item => item.id !== id));
  };

  // Download logic: Embed base64 image into an SVG tag with proper headers and dimensions
  const handleDownloadSVG = async () => {
      if (!result) return;
      
      // Load image to get dimensions to ensure valid SVG output
      const img = new Image();
      img.src = result;
      await new Promise((resolve) => { img.onload = resolve; });
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${result}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" />
</svg>`;
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vector_converted_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // Download PNG logic
  const handleDownloadPNG = () => {
      if (!result) return;
      const link = document.createElement('a');
      link.href = result; // result is already a base64 png from Gemini
      link.download = `vector_converted_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px]">
      {loading && <LoadingOverlay message={t.vector.loading} t={t} />}

      {/* --- COLUMN 1: CONTROL PANEL --- */}
      <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
        
        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
           <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
           {t.vector.panelTitle}
        </h3>

        {/* Style */}
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t.vector.styleLabel}</label>
            <select 
                value={config.style}
                onChange={(e) => setConfig({...config, style: e.target.value as VectorStyle})}
                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
                {Object.entries(t.vector.styles).map(([key, label]) => (
                    <option key={key} value={key}>{label as string}</option>
                ))}
            </select>
        </div>

        {/* Quality */}
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t.vector.qualityLabel}</label>
            <select 
                value={config.quality}
                onChange={(e) => setConfig({...config, quality: e.target.value as any})}
                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
                <option value="keep_original">{t.vector.qualityKeep}</option>
                <option value="enhance">{t.vector.qualityEnhance}</option>
            </select>
        </div>

        {/* Upscale */}
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t.vector.upscaleLabel}</label>
            <div className="grid grid-cols-4 gap-2">
                {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => (
                     <button
                        key={opt}
                        onClick={() => setConfig({...config, upscale: opt as any})}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                            config.upscale === opt 
                            ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-700 dark:text-purple-300' 
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-purple-400'
                        }`}
                     >
                        {opt === 'ultra_hd' ? 'U-HD' : opt.toUpperCase()}
                     </button>
                ))}
            </div>
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t.vector.promptLabel}</label>
             <textarea 
                value={config.customPrompt}
                onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                placeholder={t.vector.promptPlaceholder}
                className="w-full p-3 h-20 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 resize-none focus:ring-2 focus:ring-purple-500"
             />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
            <Button 
                onClick={handleProcess}
                disabled={!image || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 py-3 text-base"
            >
                {t.vector.btnStart} <ArrowRight size={18} className="ml-2" />
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
                 <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <RefreshCcw size={16} /> {t.vector.btnReset}
                 </button>
                 <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <LogOut size={16} /> {t.vector.btnExit}
                 </button>
            </div>
        </div>

        {/* History */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-sm text-slate-500 dark:text-slate-400 uppercase mb-3">{t.vector.historyTitle}</h4>
            <div className="space-y-3">
                {history.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                        <img src={item.resultImage} className="w-12 h-12 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{t.vector.styles[item.config.style]}</div>
                            <div className="text-[10px] text-slate-500 truncate">{new Date(item.timestamp).toLocaleTimeString()}</div>
                            <div className="flex gap-2 mt-1">
                                <button onClick={() => handleRestore(item)} className="text-[10px] text-blue-600 hover:underline">{t.vector.btnRestore}</button>
                                <button onClick={() => handleDeleteHistory(item.id)} className="text-[10px] text-red-600 hover:underline">{t.vector.btnDelete}</button>
                            </div>
                        </div>
                    </div>
                ))}
                {history.length === 0 && <p className="text-xs text-slate-400 italic">Chưa có lịch sử</p>}
            </div>
        </div>

        {error && <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-800 text-center">{error}</div>}

      </div>

      {/* --- COLUMN 2: INPUT AREA (BEFORE) --- */}
      <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
         <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.vector.beforeLabel}</div>
         <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col relative overflow-hidden">
             {image ? (
                <div className="relative w-full h-full p-4 flex items-center justify-center">
                    <img src={image.base64} className="max-w-full max-h-full object-contain shadow-sm" />
                    <button 
                        onClick={() => setImage(null)} 
                        className="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900 text-white p-2 rounded-full backdrop-blur transition-all"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
             ) : (
                <div className="w-full h-full p-6">
                    <ImageUploader 
                        onImageSelect={(file, base64) => setImage({file, base64})} 
                        previewUrl={null} 
                        t={t}
                    />
                </div>
             )}
         </div>
      </div>

      {/* --- COLUMN 3: OUTPUT AREA (AFTER) --- */}
      <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.vector.afterLabel}</div>
          <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
              {result ? (
                  <div className="w-full h-full flex flex-col">
                      <div className="flex-1 p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]">
                           <img src={result} className="max-w-full max-h-full object-contain shadow-xl" />
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                          {/* SVG Download */}
                          <button 
                            onClick={handleDownloadSVG}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105"
                          >
                              <Download size={20} /> {t.vector.downloadSVG}
                          </button>
                          
                          {/* PNG Download */}
                          <button 
                            onClick={handleDownloadPNG}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105"
                          >
                              <ImageIcon size={20} /> {t.vector.downloadPNG}
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                       <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 mb-4 flex items-center justify-center animate-pulse">
                           <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                       </div>
                       <p className="font-medium">{t.vector.emptyOutput}</p>
                  </div>
              )}
          </div>
      </div>

    </div>
  );
};

export default VectorConversionTool;