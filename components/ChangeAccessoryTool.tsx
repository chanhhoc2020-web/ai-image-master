
import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';

interface ChangeAccessoryToolProps {
  t: any;
}

const ChangeAccessoryTool: React.FC<ChangeAccessoryToolProps> = ({ t }) => {
  const [mainImage, setMainImage] = useState<{file: File, base64: string} | null>(null);
  const [accessoryImage, setAccessoryImage] = useState<{file: File, base64: string} | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!mainImage || !accessoryImage) {
      setError(t.accessory.errImages);
      return;
    }
    if (!prompt) {
      setError(t.accessory.errPrompt);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const output = await processImage(
        ToolType.CHANGE_ACCESSORY,
        mainImage.base64,
        mainImage.file.type,
        prompt,
        undefined,
        accessoryImage.base64
      );
      setResult(output);
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {loading && <LoadingOverlay message={t.accessory.loading} t={t} />}
      
      <div className="space-y-6">
        {/* Main Image */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs">1</span>
            {t.accessory.labelMain}
          </label>
          <ImageUploader 
            onImageSelect={(file, base64) => setMainImage({file, base64})} 
            previewUrl={mainImage?.base64 || null} 
            t={t}
          />
        </div>

        {/* Accessory Image */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
            <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs">2</span>
            {t.accessory.labelAccessory}
          </label>
          <ImageUploader 
            onImageSelect={(file, base64) => setAccessoryImage({file, base64})} 
            previewUrl={accessoryImage?.base64 || null} 
            t={t}
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.accessory.descLabel} <span className="text-red-500">*</span></label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.accessory.descPlaceholder}
            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-24 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <button
          onClick={handleProcess}
          disabled={!mainImage || !accessoryImage || loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/40 transition-all flex items-center justify-center gap-2"
        >
          {loading ? t.common.processing : t.accessory.btnProcess}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800">{error}</div>}
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.common.result}</label>
        <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 aspect-square flex items-center justify-center overflow-hidden relative shadow-inner">
          {result ? (
            <div className="w-full h-full flex flex-col">
              <img src={result} alt="Result" className="w-full h-full object-contain p-2" />
              <a 
                href={result} 
                download="accessory_added.png"
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 p-2 rounded-lg shadow-md border border-slate-200 flex items-center gap-1 text-xs font-bold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t.common.download}
              </a>
            </div>
          ) : (
            <div className="text-slate-400 text-center px-6">
              <div className="flex justify-center -space-x-4 mb-4 opacity-30">
                 <div className="w-12 h-12 rounded-full border-2 border-slate-300 bg-white dark:bg-slate-600"></div>
                 <div className="w-12 h-12 rounded-full border-2 border-slate-300 bg-slate-100 dark:bg-slate-700"></div>
              </div>
              <p>{t.common.noResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangeAccessoryTool;
