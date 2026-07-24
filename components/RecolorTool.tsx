
import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';

declare global {
  interface Window {
    EyeDropper: any;
  }
}

interface RecolorToolProps {
  t: any;
}

const RecolorTool: React.FC<RecolorToolProps> = ({ t }) => {
  const [image, setImage] = useState<{file: File, base64: string} | null>(null);
  
  // State for advanced color tools
  const [targetObject, setTargetObject] = useState('');
  const [colorMode, setColorMode] = useState<'picker' | 'reference'>('picker');
  const [selectedColor, setSelectedColor] = useState('#3b82f6'); // Default Blue
  const [refImage, setRefImage] = useState<string | null>(null);
  const [additionalNote, setAdditionalNote] = useState('');
  
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle EyeDropper API
  const handleEyeDropper = async () => {
    if (!window.EyeDropper) {
      alert("Trình duyệt của bạn không hỗ trợ công cụ hút màu.");
      return;
    }
    const eyeDropper = new window.EyeDropper();
    try {
      const result = await eyeDropper.open();
      setSelectedColor(result.sRGBHex);
    } catch (e) {
      console.log('User canceled the eyedropper');
    }
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!image) return;
    if (!targetObject) {
      setError(t.recolor.errObject);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Construct prompt based on mode
      let prompt = `Object to recolor: ${targetObject}. `;
      
      if (colorMode === 'picker') {
        prompt += `Target color HEX code: ${selectedColor}. `;
      } else {
        prompt += `Target color: Match the color style of the provided reference image. `;
      }

      if (additionalNote) {
        prompt += `Instructions: ${additionalNote}`;
      }

      // Pass refImage if in reference mode, otherwise undefined
      const referenceData = (colorMode === 'reference' && refImage) ? refImage : undefined;

      const output = await processImage(
        ToolType.RECOLOR, 
        image.base64, 
        image.file.type, 
        prompt, 
        undefined, 
        referenceData
      );
      
      setResult(output);
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {loading && <LoadingOverlay message={t.recolor.loading} t={t} />}
      
      <div className="space-y-6">
        {/* Main Image Upload */}
        <ImageUploader 
          onImageSelect={(file, base64) => setImage({file, base64})} 
          previewUrl={image?.base64 || null} 
          t={t}
        />
        
        <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-5 transition-colors">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                {t.recolor.settingsTitle}
            </h3>

            {/* Object Input */}
            <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.recolor.objectLabel} <span className="text-red-500">*</span></label>
                <input
                    type="text"
                    value={targetObject}
                    onChange={(e) => setTargetObject(e.target.value)}
                    placeholder={t.recolor.objectPlaceholder}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
            </div>

            {/* Mode Toggle */}
            <div className="flex bg-white dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                <button
                    onClick={() => setColorMode('picker')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        colorMode === 'picker' ? 'bg-blue-100 dark:bg-slate-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    {t.recolor.modePicker}
                </button>
                <button
                    onClick={() => setColorMode('reference')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        colorMode === 'reference' ? 'bg-blue-100 dark:bg-slate-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    {t.recolor.modeRef}
                </button>
            </div>

            {/* Color Picker Section */}
            {colorMode === 'picker' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.recolor.colorLabel}</label>
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm border border-slate-300 dark:border-slate-600">
                            <input 
                                type="color" 
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                placeholder="#RRGGBB"
                            />
                        </div>
                        <button
                            onClick={handleEyeDropper}
                            title="Hút màu từ màn hình"
                            className="p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 shadow-sm"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Reference Image Section */}
            {colorMode === 'reference' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.recolor.refLabel}</label>
                    <div className="flex gap-4 items-center">
                         <label className="cursor-pointer bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">
                            {t.recolor.selectRefImage}
                            <input type="file" onChange={handleRefImageUpload} className="hidden" accept="image/*" />
                        </label>
                        {refImage ? (
                            <div className="h-10 w-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 shadow-sm">
                                <img src={refImage} alt="Ref" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400">{t.recolor.noRefImage}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Additional Notes */}
            <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.recolor.noteLabel}</label>
                <textarea
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    placeholder={t.recolor.notePlaceholder}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm h-20 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
            </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={!image || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/40 transition-all flex items-center justify-center gap-2"
        >
          {loading ? t.common.processing : t.recolor.btnProcess}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
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
                download="recolored_image.png"
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 p-2 rounded-lg shadow-md border border-slate-200 flex items-center gap-1 text-xs font-bold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t.common.download}
              </a>
            </div>
          ) : (
            <div className="text-slate-400 text-center px-6">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
              {t.common.noResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecolorTool;
