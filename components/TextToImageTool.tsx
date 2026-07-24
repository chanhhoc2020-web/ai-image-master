
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, TextToImageConfig, TextToImageHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, CheckCircle, AlertCircle, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';

interface TextToImageToolProps {
  t: any;
}

const TextToImageTool: React.FC<TextToImageToolProps> = ({ t }) => {
  // --- STATE ---
  
  // Reference Image (Input Area)
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  
  // Results
  const [results, setResults] = useState<string[]>([]);
  
  // Config
  const [config, setConfig] = useState<TextToImageConfig>({
    count: 1,
    width: '1024',
    height: '1024',
    aspectRatio: '1:1',
    ppi: 72,
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
  const [history, setHistory] = useState<TextToImageHistoryItem[]>([]);

  // Masking (Only active if image exists)
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
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
        // Clear mask
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
                      file: file as File,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file as Blob);
          });
      }
  };

  // --- DIMENSION LOGIC ---
  const updateDimensions = (ratio: string) => {
      let w = '1024', h = '1024';
      if (ratio === '4:3') { w = '1024'; h = '768'; }
      else if (ratio === '9:16') { w = '768'; h = '1344'; } // Optimized for vertical
      else if (ratio === '16:9') { w = '1344'; h = '768'; }
      setConfig(prev => ({ ...prev, aspectRatio: ratio as any, width: w, height: h }));
  };

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
      if (!data.some(p => p !== 0)) return null;
      return canvasRef.current.toDataURL('image/png');
  };

  // --- PROCESS ---

  const handleProcess = async () => {
    if (!config.customPrompt && !image) {
        setError("Vui lòng nhập mô tả hoặc tải ảnh tham chiếu.");
        return;
    }

    setLoading(true); setError(null);
    setResults([]);
    
    try {
        const mask = image ? getMaskBase64() : null;
        const generatedImages: string[] = [];

        for (let i = 0; i < config.count; i++) {
            setLoadingMessage(`${t.textToImage.waitMessage} (${i + 1}/${config.count})`);
            
            // Add slight variation to prompt for subsequent images if creating multiple
            let loopPrompt = config.customPrompt;
            if (i > 0) loopPrompt += ` (Variation ${i+1}: Create a slightly different composition or perspective).`;

            const output = await processImage(
                ToolType.TEXT_TO_IMAGE,
                image ? image.base64 : null,
                image ? image.file.type : null,
                loopPrompt,
                { ...config, mask: mask || undefined },
                additionalAssets.map(a => a.base64)
            );
            generatedImages.push(output);
            // Update UI incrementally
            setResults(prev => [...prev, output]);
        }

        // History
        const historyItem: TextToImageHistoryItem = {
            id: Date.now().toString(),
            refImage: image?.base64,
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

  const handleRefine = () => {
      if (!refinePrompt) return;
      const updatedPrompt = `${config.customPrompt}. Refinement: ${refinePrompt}`;
      setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));
      handleProcess();
      setRefinePrompt('');
  };

  const handleReset = () => {
      setImage(null);
      setAdditionalAssets([]);
      setResults([]);
      setConfig({
        count: 1,
        width: '1024',
        height: '1024',
        aspectRatio: '1:1',
        ppi: 72,
        style: 'none',
        enhancements: { lightBalance: false, denoise: false, hdr: false, sharpen: false },
        customPrompt: ''
      });
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleDownloadAll = async () => {
      if (results.length === 0) return;
      setLoading(true);
      setLoadingMessage(t.textToImage.zipGenerating);
      try {
          const zip = new JSZip();
          results.forEach((res, idx) => {
              const data = res.split(',')[1];
              zip.file(`generated_${idx + 1}.png`, data, {base64: true});
          });
          const blob = await zip.generateAsync({type: "blob"});
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = "generated_images.zip";
          link.click();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
          setLoadingMessage('');
      }
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  const handleRestore = (item: TextToImageHistoryItem) => {
      if (item.refImage) {
          setImage({ file: new File([], "restored_ref"), base64: item.refImage, width: 0, height: 0 }); // Recalc dimensions on load
      } else {
          setImage(null);
      }
      setResults(item.results);
      setConfig(item.config);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={loadingMessage || t.textToImage.waitMessage} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Sparkles className="text-purple-500" />
                {t.textToImage.panelTitle}
            </h3>

            {/* 1. Count */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.countLabel}</label>
                <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    {[1, 2, 3, 4].map(num => (
                        <button 
                            key={num}
                            onClick={() => setConfig({...config, count: num as any})}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.count === num ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-purple-500'}`}
                        >
                            {num} {t.textToImage.images}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Dimensions */}
            <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.sizeLabel}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {['1:1', '4:3', '9:16', '16:9'].map(ratio => (
                        <button
                            key={ratio}
                            onClick={() => updateDimensions(ratio)}
                            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border ${config.aspectRatio === ratio ? 'bg-purple-50 border-purple-500 text-purple-600' : 'border-slate-200 dark:border-slate-600'}`}
                        >
                            {ratio}
                        </button>
                    ))}
                    <button onClick={() => setConfig({...config, aspectRatio: 'custom'})} className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded border ${config.aspectRatio === 'custom' ? 'bg-purple-50 border-purple-500 text-purple-600' : 'border-slate-200 dark:border-slate-600'}`}>
                        {t.textToImage.sizeCustom}
                    </button>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">{t.textToImage.width}</label>
                        <input type="number" value={config.width} onChange={(e) => setConfig({...config, width: e.target.value})} className="w-full p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-900" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">{t.textToImage.height}</label>
                        <input type="number" value={config.height} onChange={(e) => setConfig({...config, height: e.target.value})} className="w-full p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-900" />
                    </div>
                </div>
            </div>

            {/* 3. PPI */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.ppiLabel}</label>
                <select 
                    value={config.ppi} 
                    onChange={(e) => setConfig({...config, ppi: parseInt(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    <option value={72}>72 PPI (Web)</option>
                    <option value={96}>96 PPI (Screen)</option>
                    <option value={144}>144 PPI (Retina)</option>
                    <option value={240}>240 PPI (Print)</option>
                    <option value={300}>300 PPI (Pro Print)</option>
                    <option value={-1}>{t.textToImage.ppiCustom}</option>
                </select>
                {config.ppi === -1 && (
                    <input type="number" placeholder="Enter PPI" onChange={(e) => setConfig({...config, ppi: parseInt(e.target.value) || 300})} className="w-full mt-1 p-2 border rounded text-sm" />
                )}
            </div>

            {/* 4. Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.styleLabel}</label>
                <select 
                    value={config.style} 
                    onChange={(e) => setConfig({...config, style: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.entries(t.textToImage.styles).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                    ))}
                </select>
            </div>

            {/* 5. Masking (Conditional) */}
            {image && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-purple-50 border-purple-500 text-purple-600' : 'border-slate-200'}`}>
                            <Brush size={12} /> {t.textToImage.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 border-slate-400' : 'border-slate-200'}`}>
                            <Eraser size={12} /> {t.textToImage.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.textToImage.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                    </div>
                </div>
            )}

            {/* 6. Enhancements (Only if image loaded) */}
            {image && (
                <div className="space-y-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.enhanceTitle}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: 'lightBalance', label: t.textToImage.enhanceLight },
                            { key: 'denoise', label: t.textToImage.enhanceDenoise },
                            { key: 'hdr', label: t.textToImage.enhanceHdr },
                            { key: 'sharpen', label: t.textToImage.enhanceSharpen },
                        ].map(opt => (
                            <label key={opt.key} className="flex items-center gap-2 text-[10px] cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={config.enhancements[opt.key as keyof typeof config.enhancements]}
                                    onChange={(e) => setConfig({
                                        ...config, 
                                        enhancements: { ...config.enhancements, [opt.key]: e.target.checked }
                                    })}
                                    className="rounded text-purple-600"
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* 7. Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.textToImage.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.textToImage.promptPlaceholder}
                    className="w-full p-2 h-24 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none focus:ring-2 focus:ring-purple-500"
                />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 shadow-lg text-base"
                >
                    {t.textToImage.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.textToImage.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.textToImage.btnExit}
                     </button>
                </div>
            </div>

            {/* History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.textToImage.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.results[0]} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">Gen ({item.results.length})</div>
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

       {/* --- CENTER: INPUT AREA --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.textToImage.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                
                {/* Main Image Upload (Optional Reference) */}
                <div className="flex-1 flex flex-col min-h-[300px] mb-4">
                    <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{t.textToImage.uploadRef}</label>
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
                        <Plus size={16} /> {t.textToImage.uploadAssets}
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
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.textToImage.outputArea}</div>
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
                                        <a href={res} download={`generated_${idx+1}.png`} className="bg-white text-slate-900 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-gray-100">
                                            <Download size={12} /> {t.textToImage.download}
                                        </a>
                                        <button onClick={() => setResults(prev => prev.filter((_, i) => i !== idx))} className="bg-red-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-red-600">
                                            <Trash2 size={12} />
                                        </button>
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
                                    placeholder={t.textToImage.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    <Send size={16} />
                                </button>
                            </div>
                            {results.length > 1 && (
                                <button onClick={handleDownloadAll} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                    <Download size={18} /> {t.textToImage.downloadAll}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 p-10 text-center">
                        <div>
                            <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                            <p>{t.textToImage.emptyOutput}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default TextToImageTool;
