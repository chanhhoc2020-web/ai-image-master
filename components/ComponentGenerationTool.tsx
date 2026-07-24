
import React, { useState, useRef } from 'react';
import { ToolType, ComponentGenerationConfig, ComponentGenerationHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Layers, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';

interface ComponentGenerationToolProps {
  t: any;
}

const ComponentGenerationTool: React.FC<ComponentGenerationToolProps> = ({ t }) => {
  // --- STATE ---
  const [components, setComponents] = useState<{id: string, file: File, base64: string}[]>([]);
  const [results, setResults] = useState<string[]>([]);
  
  const [config, setConfig] = useState<ComponentGenerationConfig>({
    imageCount: 1,
    width: '1024',
    height: '1024',
    aspectRatio: '1:1',
    ppi: 72, // Default to Web/Screen
    style: 'none',
    enhancements: {
      lightBalance: false,
      denoise: false,
      hdr: false,
      sharpen: false,
    },
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [history, setHistory] = useState<ComponentGenerationHistoryItem[]>([]);

  // --- HANDLERS ---

  const handleComponentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files);
          files.forEach(file => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  setComponents(prev => [...prev, {
                      id: Math.random().toString(),
                      file: file as File,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file as Blob);
          });
      }
  };

  const removeComponent = (id: string) => {
      setComponents(prev => prev.filter(c => c.id !== id));
  };

  const updateDimensions = (ratio: string) => {
      let w = '1024', h = '1024';
      if (ratio === '4:3') { w = '1024'; h = '768'; }
      else if (ratio === '9:16') { w = '768'; h = '1344'; }
      else if (ratio === '16:9') { w = '1344'; h = '768'; }
      setConfig(prev => ({ ...prev, aspectRatio: ratio as any, width: w, height: h }));
  };

  // --- IMAGE PROCESSING HELPER ---
  const resizeToTarget = async (base64Str: string, targetW: number, targetH: number): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = targetW;
              canvas.height = targetH;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  // Use high quality image smoothing for resizing
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  
                  // Draw image to fill the target dimensions exactly
                  ctx.drawImage(img, 0, 0, targetW, targetH);
                  
                  // Return as PNG
                  resolve(canvas.toDataURL('image/png', 1.0));
              } else {
                  // Fallback if canvas fails
                  resolve(base64Str);
              }
          };
          img.onerror = () => resolve(base64Str);
      });
  };

  const handleProcess = async () => {
    if (components.length === 0) {
        setError("Vui lòng tải lên ít nhất 1 thành phần.");
        return;
    }

    // Validate Dimensions
    const targetW = parseInt(config.width);
    const targetH = parseInt(config.height);
    if (isNaN(targetW) || isNaN(targetH) || targetW <= 0 || targetH <= 0) {
        setError("Kích thước nhập vào không hợp lệ.");
        return;
    }

    setLoading(true); setError(null);
    setResults([]);
    
    try {
        const generatedImages: string[] = [];

        for (let i = 0; i < config.imageCount; i++) {
            setLoadingMessage(`${t.common.processing} (${i + 1}/${config.imageCount})`);
            
            // Varied prompt for multiples
            let loopPrompt = config.customPrompt;
            if (i > 0) loopPrompt += ` (Variation ${i+1}: Create a slightly different composition).`;

            // 1. Generate Image with AI
            const rawOutput = await processImage(
                ToolType.COMPONENT_GENERATION,
                null, // No main single image
                null,
                loopPrompt,
                config,
                components.map(c => c.base64)
            );

            // 2. Post-process: Resize/Resample to exact user dimensions
            // AI creates the composition, but we enforce the exact pixel dimensions here
            const finalOutput = await resizeToTarget(rawOutput, targetW, targetH);

            generatedImages.push(finalOutput);
            setResults(prev => [...prev, finalOutput]);
        }

        // History
        const historyItem: ComponentGenerationHistoryItem = {
            id: Date.now().toString(),
            componentImages: components.map(c => c.base64),
            results: generatedImages,
            config: { ...config },
            prompt: config.customPrompt,
            timestamp: Date.now()
        };
        setHistory(prev => [historyItem, ...prev]);

    } catch (err: any) {
        setError(err.message || t.common.error);
    } finally {
        setLoading(false);
        setLoadingMessage('');
    }
  };

  const handleRefine = (index: number) => {
      if (!refinePrompt) return;
      
      const updatedPrompt = `${config.customPrompt}. Refinement: ${refinePrompt}`;
      // Temporarily set image count to 1 for refinement
      const originalCount = config.imageCount;
      setConfig(prev => ({ ...prev, customPrompt: updatedPrompt, imageCount: 1 }));
      
      handleProcess().then(() => {
          // Restore original count setting
          setConfig(prev => ({ ...prev, imageCount: originalCount }));
      });
      
      setRefinePrompt('');
  };

  const handleDownloadAll = async () => {
      if (results.length === 0) return;
      setLoading(true);
      try {
          const zip = new JSZip();
          results.forEach((res, idx) => {
              const data = res.split(',')[1];
              zip.file(`generated_component_${idx + 1}.png`, data, {base64: true});
          });
          const blob = await zip.generateAsync({type: "blob"});
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = "components_generated.zip";
          link.click();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleReset = () => {
      setComponents([]);
      setResults([]);
      setConfig(prev => ({...prev, customPrompt: ''}));
  };

  const handleRestore = (item: ComponentGenerationHistoryItem) => {
      setComponents(item.componentImages.map(b64 => ({
          id: Math.random().toString(),
          file: new File([], "restored_component"),
          base64: b64
      })));
      setResults(item.results);
      setConfig(item.config);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={loadingMessage || t.common.processing} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Layers className="text-pink-500" />
                {t.componentGeneration.panelTitle}
            </h3>

            {/* 1. Image Count */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.imageCountLabel}</label>
                <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    {[1, 2, 3, 4].map(num => (
                        <button 
                            key={num}
                            onClick={() => setConfig({...config, imageCount: num})}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.imageCount === num ? 'bg-pink-600 text-white shadow' : 'text-slate-500 hover:text-pink-500'}`}
                        >
                            {num} {t.componentGeneration.imgCount}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Dimensions */}
            <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.sizeLabel}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {['1:1', '4:3', '9:16', '16:9'].map(ratio => (
                        <button
                            key={ratio}
                            onClick={() => updateDimensions(ratio)}
                            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border ${config.aspectRatio === ratio ? 'bg-pink-50 border-pink-500 text-pink-600' : 'border-slate-200 dark:border-slate-600'}`}
                        >
                            {ratio}
                        </button>
                    ))}
                    <button onClick={() => setConfig({...config, aspectRatio: 'custom'})} className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border ${config.aspectRatio === 'custom' ? 'bg-pink-50 border-pink-500 text-pink-600' : 'border-slate-200 dark:border-slate-600'}`}>
                        {t.componentGeneration.sizeCustom}
                    </button>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">{t.componentGeneration.width}</label>
                        <input type="number" value={config.width} onChange={(e) => setConfig({...config, width: e.target.value})} className="w-full p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-900" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">{t.componentGeneration.height}</label>
                        <input type="number" value={config.height} onChange={(e) => setConfig({...config, height: e.target.value})} className="w-full p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-900" />
                    </div>
                </div>
            </div>

            {/* 3. Resolution (pixels/inch) */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.ppiLabel}</label>
                
                {/* Manual Input */}
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        value={config.ppi}
                        onChange={(e) => setConfig({...config, ppi: parseInt(e.target.value) || 0})}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
                        placeholder={t.componentGeneration.ppiPlaceholder}
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap font-medium">pixels/inch</span>
                </div>

                {/* Suggestions Frame */}
                <div className="bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase">{t.componentGeneration.resolutionSuggestions}</p>
                    <div className="space-y-1">
                        {Object.entries(t.componentGeneration.resolutions).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setConfig({...config, ppi: parseInt(val)})}
                                className={`w-full text-left text-[10px] py-1.5 px-2 rounded flex justify-between items-center transition-colors ${config.ppi === parseInt(val) ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-transparent'}`}
                            >
                                <span>{label as string}</span>
                                {config.ppi === parseInt(val) && <span className="text-pink-500">✓</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.styleLabel}</label>
                <select 
                    value={config.style} 
                    onChange={(e) => setConfig({...config, style: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.entries(t.componentGeneration.styles).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                    ))}
                </select>
            </div>

            {/* 5. Enhancements */}
            <div className="space-y-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.enhanceTitle}</label>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { key: 'lightBalance', label: t.componentGeneration.enhanceLight },
                        { key: 'denoise', label: t.componentGeneration.enhanceDenoise },
                        { key: 'hdr', label: t.componentGeneration.enhanceHdr },
                        { key: 'sharpen', label: t.componentGeneration.enhanceSharpen },
                    ].map(opt => (
                        <label key={opt.key} className="flex items-center gap-2 text-[10px] cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={config.enhancements[opt.key as keyof typeof config.enhancements]}
                                onChange={(e) => setConfig({
                                    ...config, 
                                    enhancements: { ...config.enhancements, [opt.key]: e.target.checked }
                                })}
                                className="rounded text-pink-600"
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* 6. Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.componentGeneration.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.componentGeneration.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none focus:ring-2 focus:ring-pink-500"
                />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading || components.length === 0}
                    className="w-full py-3 bg-pink-600 hover:bg-pink-700 shadow-lg text-base"
                >
                    {t.componentGeneration.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.componentGeneration.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.componentGeneration.btnExit}
                     </button>
                </div>
            </div>

            {/* History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.componentGeneration.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.results[0]} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">Generated ({item.results.length})</div>
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

       {/* --- CENTER: BEFORE (INPUT AREA) --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xl text-slate-500 uppercase px-1">BEFORE</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Add Button */}
                    <label className="aspect-video rounded-xl border-2 border-dashed border-pink-300 dark:border-pink-700 bg-pink-50 dark:bg-pink-900/10 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-all min-h-[163px]">
                        <Plus size={40} className="text-pink-500 mb-2" />
                        <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{t.componentGeneration.dragDropHint}</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleComponentUpload} />
                    </label>

                    {/* Component List */}
                    {components.map((comp, idx) => (
                        <div key={comp.id} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-900 group">
                            <img src={comp.base64} className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                                {t.componentGeneration.uploadComponent} {idx + 1}
                            </div>
                            <button 
                                onClick={() => removeComponent(comp.id)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                {components.length === 0 && (
                    <div className="mt-8 text-center text-slate-400 text-sm italic">
                        {t.componentGeneration.formats}
                    </div>
                )}
            </div>
       </div>

       {/* --- RIGHT: AFTER (OUTPUT AREA) --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xl text-slate-500 uppercase px-1">AFTER</div>
            <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                {results.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                        <div className={`flex-1 p-3 grid gap-3 overflow-y-auto ${results.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {results.map((res, idx) => (
                                <div key={idx} className="relative w-full h-full bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 group overflow-hidden flex flex-col">
                                    <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                                        <img src={res} className="max-w-full max-h-full object-contain" />
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2 z-10">
                                        <a href={res} download={`generated_component_${idx+1}.png`} className="bg-white text-slate-900 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-gray-100">
                                            <Download size={12} /> {t.componentGeneration.btnDownload}
                                        </a>
                                        <button onClick={() => setResults(prev => prev.filter((_, i) => i !== idx))} className="bg-red-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-red-600">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        {config.width}x{config.height}px
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                            {/* Refine */}
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    placeholder={t.componentGeneration.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine(0)}
                                />
                                <button onClick={() => handleRefine(0)} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    <Send size={16} />
                                </button>
                            </div>
                            {results.length > 1 && (
                                <button onClick={handleDownloadAll} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                    <Download size={18} /> {t.componentGeneration.btnDownloadAll}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 p-10 text-center">
                        <div>
                            <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                            <p>{t.componentGeneration.waitingResult}</p>
                        </div>
                    </div>
                )}
            </div>
       </div>

       {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default ComponentGenerationTool;
