
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, LogoDesignConfig, LogoHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, Upload, Palette, X, Copy, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';

interface LogoDesignToolProps {
  t: any;
}

const LogoDesignTool: React.FC<LogoDesignToolProps> = ({ t }) => {
  // --- STATE ---
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  
  // Results (Array of 4 images)
  const [results, setResults] = useState<string[]>([]);
  
  // Config
  const [config, setConfig] = useState<LogoDesignConfig>({
    industry: 'real_estate',
    style: 'modern',
    structure: 'combination',
    brandName: '',
    colorMode: 'custom',
    colors: [],
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  // UI State
  const [newColor, setNewColor] = useState('#000000');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // History
  const [history, setHistory] = useState<LogoHistoryItem[]>([]);

  // Masking State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- HANDLERS ---

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage({
          file,
          base64: e.target?.result as string,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        // Reset results and mask when new image loaded
        setResults([]);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files);
          files.forEach(file => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  setAdditionalAssets(prev => [...prev, {
                      id: Math.random().toString(),
                      file,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file as Blob);
          });
      }
  };

  const handleAddColor = () => {
      if (!config.colors.includes(newColor)) {
          setConfig(prev => ({...prev, colors: [...prev.colors, newColor]}));
      }
  };

  const handleRemoveColor = (color: string) => {
      setConfig(prev => ({...prev, colors: prev.colors.filter(c => c !== color)}));
  };

  // Ensure "auto_image" settings are reverted if image is removed
  useEffect(() => {
      if (!image) {
          setConfig(prev => ({
              ...prev,
              industry: prev.industry === 'auto_match' ? 'real_estate' : prev.industry,
              style: prev.style === 'auto_match' ? 'modern' : prev.style,
              structure: prev.structure === 'auto_match' ? 'combination' : prev.structure,
              colorMode: prev.colorMode === 'auto_image' ? 'custom' : prev.colorMode
          }));
      }
  }, [image]);

  // --- MASKING LOGIC ---
  useEffect(() => {
    if (image && canvasRef.current) {
      canvasRef.current.width = image.width;
      canvasRef.current.height = image.height;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
    }
  }, [image]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, scale: 1 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scale: scaleX
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = brushSize * coords.scale;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if(canvasRef.current) canvasRef.current.getContext('2d')?.closePath();
  };

  const getMaskBase64 = (): string | null => {
      if (!canvasRef.current) return null;
      const ctx = canvasRef.current.getContext('2d');
      const data = ctx!.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
      // Check if not empty
      if (!data.some(p => p !== 0)) return null;
      return canvasRef.current.toDataURL('image/png');
  };

  // --- PROCESS LOGIC ---

  const handleProcess = async () => {
      // NOTE: Removed "if (!image) return;" check to allow text-to-image logo generation
      setLoading(true);
      setError(null);
      setLoadingMessage(t.logoDesign.waitMessage);
      setResults([]); // Clear previous results

      try {
          const mask = image ? getMaskBase64() : null;
          // We need 4 variations. To save time/tokens in this demo context, we'll try to run them in parallel.
          // In a real production app, you might want to queue these to avoid hitting rate limits too hard.
          const promises = Array(4).fill(0).map(() => 
              processImage(
                  ToolType.LOGO_DESIGN,
                  image ? image.base64 : null,
                  image ? image.file.type : null,
                  config.customPrompt,
                  { ...config, mask: mask || undefined },
                  additionalAssets.map(a => a.base64)
              )
          );

          const generatedImages = await Promise.all(promises);
          setResults(generatedImages);

          // Save History
          const historyItem: LogoHistoryItem = {
              id: Date.now().toString(),
              originalImage: image ? image.base64 : '', // Store empty if no original image
              additionalAssets: additionalAssets.map(a => a.base64),
              results: generatedImages,
              config: { ...config },
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

  const handleRefine = () => {
      if (!refinePrompt || results.length === 0) return;
      const updatedPrompt = `${config.customPrompt} \n\n Refinement: ${refinePrompt}`;
      setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));
      handleProcess(); // Re-run with new prompt
      setRefinePrompt('');
  };

  const handleReset = () => {
      setImage(null);
      setAdditionalAssets([]);
      setResults([]);
      setConfig({ ...config, brandName: '', customPrompt: '', colors: [] });
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleDownloadAll = async () => {
      if (results.length === 0) return;
      setLoading(true);
      setLoadingMessage(t.logoDesign.zipGenerating);
      try {
          const zip = new JSZip();
          results.forEach((res, idx) => {
              const data = res.split(',')[1];
              zip.file(`logo_option_${idx + 1}.png`, data, {base64: true});
          });
          const blob = await zip.generateAsync({type: "blob"});
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = "logo_designs.zip";
          link.click();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
          setLoadingMessage('');
      }
  };

  const handleRestore = (item: LogoHistoryItem) => {
      if (item.originalImage) {
          setImage({ file: new File([], "restored"), base64: item.originalImage, width: 0, height: 0 }); // Size will fix in effect
      } else {
          setImage(null);
      }
      setAdditionalAssets(item.additionalAssets.map(b64 => ({ id: Math.random().toString(), file: new File([], "asset"), base64: b64 })));
      setResults(item.results);
      setConfig(item.config);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
        {loading && <LoadingOverlay message={loadingMessage || t.logoDesign.loading} t={t} />}

        {/* --- LEFT: CONTROL PANEL --- */}
        <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.logoDesign.panelTitle}
            </h3>

            {/* 1. Industry */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.industryLabel}</label>
                <select 
                    value={config.industry} 
                    onChange={(e) => setConfig({...config, industry: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {/* Check if image exists, if not, disable auto_match option logic is handled by option disabled attr */}
                    {Object.keys(t.logoDesign.industries).sort((a,b) => t.logoDesign.industries[a].localeCompare(t.logoDesign.industries[b])).map(key => (
                        <option key={key} value={key} disabled={key === 'auto_match' && !image}>
                            {t.logoDesign.industries[key]}
                        </option>
                    ))}
                </select>
            </div>

            {/* 2. Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.styleLabel}</label>
                <select 
                    value={config.style} 
                    onChange={(e) => setConfig({...config, style: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.logoDesign.styles).sort((a,b) => t.logoDesign.styles[a].localeCompare(t.logoDesign.styles[b])).map(key => (
                        <option key={key} value={key} disabled={key === 'auto_match' && !image}>
                            {t.logoDesign.styles[key]}
                        </option>
                    ))}
                </select>
            </div>

            {/* 3. Structure */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.structureLabel}</label>
                <select 
                    value={config.structure} 
                    onChange={(e) => setConfig({...config, structure: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.logoDesign.structures).sort((a,b) => t.logoDesign.structures[a].localeCompare(t.logoDesign.structures[b])).map(key => (
                        <option key={key} value={key} disabled={key === 'auto_match' && !image}>
                            {t.logoDesign.structures[key]}
                        </option>
                    ))}
                </select>
            </div>

            {/* 4. Colors */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.colorsLabel}</label>
                
                {/* Color Mode Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-2">
                    <button
                        onClick={() => setConfig({ ...config, colorMode: 'custom' })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${config.colorMode === 'custom' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Palette size={12} /> {t.logoDesign.colorModeCustom}
                    </button>
                    <button
                        onClick={() => setConfig({ ...config, colorMode: 'auto_image' })}
                        disabled={!image}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${config.colorMode === 'auto_image' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'} ${!image ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <ImageIcon size={12} /> {t.logoDesign.colorModeAuto}
                    </button>
                </div>

                {config.colorMode === 'custom' && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                        <div className="flex gap-2">
                            <div className="relative">
                                <input 
                                    type="color" 
                                    value={newColor} 
                                    onChange={(e) => setNewColor(e.target.value)} 
                                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                                />
                            </div>
                            <input 
                                type="text" 
                                value={newColor} 
                                onChange={(e) => setNewColor(e.target.value)} 
                                className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 uppercase font-mono"
                            />
                            <button onClick={handleAddColor} className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-blue-200">
                                <Plus size={20} />
                            </button>
                        </div>
                        {config.colors.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {config.colors.map(c => (
                                    <div key={c} className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 pl-2 pr-1 py-1 rounded-full text-xs">
                                        <span className="w-3 h-3 rounded-full" style={{backgroundColor: c}}></span>
                                        <span className="font-mono">{c}</span>
                                        <button onClick={() => handleRemoveColor(c)} className="hover:text-red-500 ml-1"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 5. Brand Name */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.brandNameLabel}</label>
                <input 
                    type="text" 
                    value={config.brandName}
                    onChange={(e) => setConfig({...config, brandName: e.target.value})}
                    placeholder={t.logoDesign.brandNamePlaceholder}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
            </div>

            {/* 6. Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.logoDesign.qualityLabel}</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">{t.logoDesign.qualityKeep}</option>
                         <option value="enhance">{t.logoDesign.qualityEnhance}</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.logoDesign.upscaleLabel}</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* 8. Masking Tool */}
            {image && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.logoDesign.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.logoDesign.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.logoDesign.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>
                </div>
            )}

            {/* 9. Custom Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.logoDesign.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.logoDesign.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* 10. Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading} // Enabled even without image for text-to-logo generation
                    className="w-full py-3 bg-green-600 hover:bg-green-700 shadow-lg text-base"
                >
                    {t.logoDesign.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.logoDesign.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.logoDesign.btnExit}
                     </button>
                </div>
            </div>

            {/* 11. History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.logoDesign.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.results[0]} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{item.config.brandName || "Logo Design"}</div>
                                <div className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</div>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => handleRestore(item)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                        <RotateCcw size={10} /> Restore
                                    </button>
                                    <button onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))} className="text-[10px] text-red-600 hover:underline flex items-center gap-1">
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

        {/* --- CENTER: INPUT AREA --- */}
        <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.logoDesign.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                
                {/* Main Image Upload & Masking */}
                <div className="flex-1 flex flex-col min-h-[300px] mb-4">
                    <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{t.logoDesign.uploadRef}</label>
                    {image ? (
                        <div className="relative flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group">
                            <div className="relative max-w-full max-h-full">
                                <img src={image.base64} className="block max-w-full max-h-[400px] object-contain select-none" draggable={false} />
                                <canvas 
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    className={`absolute inset-0 w-full h-full z-10 touch-none opacity-60 ${isDrawing ? 'cursor-crosshair' : ''}`}
                                />
                            </div>
                            <button onClick={() => { setImage(null); setIsDrawing(false); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-20">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1">
                            <ImageUploader onImageSelect={(file, base64) => handleImageUpload(file)} previewUrl={null} t={t} />
                        </div>
                    )}
                </div>

                {/* Additional Assets */}
                <div className="mt-auto">
                    <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Plus size={16} /> {t.logoDesign.uploadAssets}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {additionalAssets.map(asset => (
                            <div key={asset.id} className="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 group">
                                <img src={asset.base64} className="w-full h-full object-cover" />
                                <button onClick={() => setAdditionalAssets(prev => prev.filter(a => a.id !== asset.id))} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Plus size={24} className="text-slate-400" />
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleAssetUpload} />
                        </label>
                    </div>
                </div>
            </div>
        </div>

        {/* --- RIGHT: OUTPUT AREA --- */}
        <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.logoDesign.outputArea}</div>
            <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                {results.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto">
                            {results.map((res, idx) => (
                                <div key={idx} className="relative aspect-square bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 group overflow-hidden">
                                    <img src={res} className="w-full h-full object-contain p-2" />
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                                        <a href={res} download={`logo_option_${idx+1}.png`} className="bg-white text-slate-900 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-gray-100">
                                            <Download size={12} /> {t.logoDesign.download}
                                        </a>
                                    </div>
                                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-1.5 rounded">Option {idx+1}</div>
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
                                    placeholder={t.logoDesign.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    <Send size={16} />
                                </button>
                            </div>
                            <button onClick={handleDownloadAll} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                <Download size={18} /> {t.logoDesign.downloadAll}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <p>{t.logoDesign.emptyOutput}</p>
                    </div>
                )}
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default LogoDesignTool;
