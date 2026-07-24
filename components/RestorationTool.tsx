
import React, { useState, useRef } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, RestorationConfig } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';

interface RestorationToolProps {
  t: any;
}

const RestorationTool: React.FC<RestorationToolProps> = ({ t }) => {
  const [image, setImage] = useState<{file: File, base64: string} | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration State
  const [config, setConfig] = useState<RestorationConfig>({
    customPrompt: '',
    fixHair: false,
    isAsian: false,
    fixClothes: false,
    fixBackground: false,
    keepIdentity: true,
    denoise: true,
    faceEnhance: true,
    colorize: false,
    restoreLevel: 80,
    resolution: 'x4',
    style: 'normal'
  });

  const handlePreset = (type: 'high_quality' | 'colorize' | 'damaged') => {
    switch(type) {
        case 'high_quality':
            setConfig(prev => ({ ...prev, denoise: true, faceEnhance: true, restoreLevel: 90, resolution: 'ultra_hd' }));
            break;
        case 'colorize':
            setConfig(prev => ({ ...prev, colorize: true, faceEnhance: true, restoreLevel: 80 }));
            break;
        case 'damaged':
            setConfig(prev => ({ ...prev, denoise: true, fixClothes: true, fixBackground: false, restoreLevel: 100 }));
            break;
    }
  };

  const handleProcess = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const output = await processImage(
        ToolType.RESTORATION,
        image.base64,
        image.file.type,
        config.customPrompt,
        config
      );
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
        customPrompt: '',
        fixHair: false,
        isAsian: false,
        fixClothes: false,
        fixBackground: false,
        keepIdentity: true,
        denoise: true,
        faceEnhance: true,
        colorize: false,
        restoreLevel: 80,
        resolution: 'x4',
        style: 'normal'
    });
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {loading && <LoadingOverlay message={t.restoration.loading} t={t} />}

      {/* --- LEFT COLUMN: CONTROLS --- */}
      <div className="w-full xl:w-[400px] flex-shrink-0 flex flex-col gap-6 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
        
        {/* Custom Prompt */}
        <div className="space-y-2">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                {t.restoration.inputTitle}
            </h3>
            <textarea 
                value={config.customPrompt}
                onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                placeholder={t.restoration.customPromptPlaceholder}
                className="w-full p-3 h-24 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
            />
        </div>

        {/* Action Buttons (Presets) */}
        <div className="grid grid-cols-1 gap-2">
            <button onClick={() => handlePreset('high_quality')} className="text-xs font-bold py-2 px-3 bg-blue-100 dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-slate-600 transition-colors text-left border border-blue-200 dark:border-slate-600">
                ⚡ {t.restoration.presetHighQuality}
            </button>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handlePreset('colorize')} className="text-xs font-bold py-2 px-3 bg-purple-100 dark:bg-slate-700 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-slate-600 transition-colors text-left border border-purple-200 dark:border-slate-600">
                    🎨 {t.restoration.presetColorize}
                </button>
                <button onClick={() => handlePreset('damaged')} className="text-xs font-bold py-2 px-3 bg-orange-100 dark:bg-slate-700 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-slate-600 transition-colors text-left border border-orange-200 dark:border-slate-600">
                    🩹 {t.restoration.presetDamaged}
                </button>
            </div>
        </div>

        {/* Checkbox Group: Features */}
        <div className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t.restoration.groupFeatures}</h4>
            <div className="space-y-2">
                 {[
                    { key: 'fixHair', label: t.restoration.featureHair },
                    { key: 'isAsian', label: t.restoration.featureAsian },
                    { key: 'fixClothes', label: t.restoration.featureClothes },
                    { key: 'fixBackground', label: t.restoration.featureBg },
                    { key: 'keepIdentity', label: t.restoration.featureIdentity },
                 ].map((item) => (
                    <label key={item.key} className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={config[item.key as keyof RestorationConfig] as boolean}
                            onChange={(e) => setConfig({...config, [item.key]: e.target.checked})}
                            className="w-4 h-4 text-blue-600 rounded bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                    </label>
                 ))}
            </div>
        </div>

        {/* Checkbox Group: Enhancement */}
        <div className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t.restoration.groupEnhance}</h4>
            <div className="space-y-2">
                 {[
                    { key: 'denoise', label: t.restoration.enhanceDenoise },
                    { key: 'faceEnhance', label: t.restoration.enhanceFace },
                    { key: 'colorize', label: t.restoration.enhanceColor },
                 ].map((item) => (
                    <label key={item.key} className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={config[item.key as keyof RestorationConfig] as boolean}
                            onChange={(e) => setConfig({...config, [item.key]: e.target.checked})}
                            className="w-4 h-4 text-green-600 rounded bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                    </label>
                 ))}
            </div>
        </div>

        {/* Slider & Dropdowns */}
        <div className="space-y-4">
            <div className="space-y-1">
                <div className="flex justify-between">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.restoration.sliderLevel}</label>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{config.restoreLevel}%</span>
                </div>
                <input 
                    type="range" min="1" max="100" 
                    value={config.restoreLevel}
                    onChange={(e) => setConfig({...config, restoreLevel: parseInt(e.target.value)})}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">{t.restoration.resolutionLabel}</label>
                    <select 
                        value={config.resolution}
                        onChange={(e) => setConfig({...config, resolution: e.target.value as any})}
                        className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="x2">X2</option>
                        <option value="x4">X4</option>
                        <option value="ultra_hd">Ultra HD</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">{t.restoration.styleLabel}</label>
                    <select 
                        value={config.style}
                        onChange={(e) => setConfig({...config, style: e.target.value as any})}
                        className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="normal">{t.restoration.styleNormal}</option>
                        <option value="anime">{t.restoration.styleAnime}</option>
                        <option value="chibi">{t.restoration.styleChibi}</option>
                        <option value="semi_realistic">{t.restoration.styleSemi}</option>
                        <option value="moe">{t.restoration.styleMoe}</option>
                        <option value="oil_painting">{t.restoration.styleOil}</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
             <button
                onClick={handleProcess}
                disabled={!image || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all"
             >
                {t.restoration.btnStart}
             </button>
             
             <div className="grid grid-cols-2 gap-3">
                 <button
                    onClick={handleReset}
                    className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium py-2 rounded-lg transition-all text-sm"
                 >
                    {t.restoration.btnReset}
                 </button>
                 <button
                    onClick={handleReset} // Just resets for now as Exit isn't strictly defined
                    className="w-full bg-slate-300 dark:bg-slate-800 hover:bg-slate-400 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium py-2 rounded-lg transition-all text-sm"
                 >
                    {t.restoration.btnExit}
                 </button>
             </div>
        </div>

         {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800">{error}</div>}

      </div>

      {/* --- RIGHT COLUMN: DISPLAY SECTION --- */}
      <div className="flex-1 min-h-[500px] flex flex-col gap-4">
        
        {/* Main Display Area (Grid/Side-by-Side) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            
            {/* Before Image Container */}
            <div className="relative bg-black/5 dark:bg-black/40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden min-h-[300px]">
                {image ? (
                    <>
                        <img src={image.base64} className="max-w-full max-h-full object-contain p-2" alt="Original" />
                        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full">BEFORE</div>
                    </>
                ) : (
                    <div className="p-8 w-full">
                        <ImageUploader onImageSelect={(file, base64) => setImage({file, base64})} previewUrl={null} t={t} />
                    </div>
                )}
            </div>

            {/* After Image Container */}
            <div className="relative bg-black/5 dark:bg-black/40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden min-h-[300px]">
                {result ? (
                    <>
                        <img src={result} className="max-w-full max-h-full object-contain p-2" alt="Restored" />
                        <div className="absolute top-4 right-4 bg-blue-600/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">AFTER</div>
                        
                        {/* Floating Download Button (Yellow) */}
                        <a 
                            href={result} 
                            download="restored_photo.png"
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-2.5 px-6 rounded-full shadow-xl shadow-yellow-400/30 flex items-center gap-2 transition-transform hover:scale-105"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {t.restoration.btnDownload}
                        </a>
                    </>
                ) : (
                    <div className="text-slate-400 text-center px-6">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        <p>{t.common.noResult}</p>
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Actions for Display */}
        {result && (
            <div className="flex justify-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    {t.restoration.btnShare}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default RestorationTool;