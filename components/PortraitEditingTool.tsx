
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, PortraitConfig, PortraitHistoryItem, BatchItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, CheckCircle, AlertCircle, Loader2, Upload, Wand2 } from 'lucide-react';
import JSZip from 'jszip';

interface PortraitEditingToolProps {
  t: any;
}

const PortraitEditingTool: React.FC<PortraitEditingToolProps> = ({ t }) => {
  // --- STATE ---
  
  // Single Mode
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [refImage, setRefImage] = useState<{file: File, base64: string} | null>(null);
  const [result, setResult] = useState<string | null>(null);
  
  // Batch Mode
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // Masking
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom Cursor State
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  
  // Config
  const [config, setConfig] = useState<PortraitConfig>({
    mode: 'single',
    autoAdjust: false,
    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      gamma: 1.0,
    },
    style: 'natural',
    beauty: {
      wrinkles: false,
      redEye: false,
      greyHair: false,
      smoothSkin: false,
      blemishes: false,
      lipTint: {
          enabled: false,
          color: '#FF0000'
      }
    },
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [history, setHistory] = useState<PortraitHistoryItem[]>([]);

  // --- HELPERS ---

  // Handle Single Image Upload
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
        setResult(null);
        // Reset mask canvas
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Sync Canvas Size
  useEffect(() => {
    if (image && canvasRef.current) {
      canvasRef.current.width = image.width;
      canvasRef.current.height = image.height;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
      }
    }
  }, [image]);

  // --- ADJUSTMENT LOGIC ---
  const handleAutoAdjust = (enabled: boolean) => {
      if (enabled) {
          setConfig(prev => ({
              ...prev,
              autoAdjust: true,
              adjustments: {
                  brightness: 5,
                  contrast: 10,
                  saturation: 10,
                  temperature: 0,
                  gamma: 1.1
              }
          }));
      } else {
          setConfig(prev => ({
              ...prev,
              autoAdjust: false,
              adjustments: {
                  brightness: 0,
                  contrast: 0,
                  saturation: 0,
                  temperature: 0,
                  gamma: 1.0
              }
          }));
      }
  };

  const handleSliderChange = (key: keyof typeof config.adjustments, value: number) => {
      setConfig(prev => ({
          ...prev,
          autoAdjust: false, // Disabling auto when manually tweaking
          adjustments: {
              ...prev.adjustments,
              [key]: value
          }
      }));
  };

  // --- MASKING LOGIC ---
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, scale: 1 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scale: scaleX // Assuming mostly uniform scaling for brush radius
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
    // Brush style needs to be set here as well in case it wasn't set or context reset
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red semi-transparent
    }
    // Set line width based on current brush size and scale
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
    if (isDrawing && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.closePath();
        ctx!.globalCompositeOperation = 'source-over';
    }
    setIsDrawing(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      if (isDrawing) {
          draw(e);
      }
  };

  const handleMouseEnter = () => setShowCursor(true);
  
  const handleMouseLeave = () => {
      setShowCursor(false);
      stopDrawing();
  };

  const getMaskBase64 = (): string | null => {
      if (!canvasRef.current) return null;
      // Check if canvas is empty
      const ctx = canvasRef.current.getContext('2d');
      const pixelBuffer = new Uint32Array(
        ctx!.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data.buffer
      );
      if (!pixelBuffer.some(color => color !== 0)) return null;

      return canvasRef.current.toDataURL('image/png');
  };

  // --- BAKING FILTERS INTO IMAGE ---
  const getProcessedImageBase64 = async (): Promise<string> => {
      if (!image) return '';
      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          if(!ctx) return resolve(image.base64);

          const img = new Image();
          img.onload = () => {
              // Apply CSS-like filters
              const { brightness, contrast, saturation, temperature, gamma } = config.adjustments;
              // Temp approximation: sepia/hue-rotate mix
              let filterString = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
              
              // Temperature simulation (Sepia + Hue)
              if (temperature > 0) {
                  filterString += ` sepia(${temperature * 0.5}%)`; 
              } else if (temperature < 0) {
                  filterString += ` hue-rotate(${temperature}deg)`; // cooler
              }

              ctx.filter = filterString;
              ctx.drawImage(img, 0, 0, image.width, image.height);
              resolve(canvas.toDataURL(image.file.type));
          };
          img.src = image.base64;
      });
  };

  // --- PROCESSING ---

  const handleProcessSingle = async () => {
    if (!image) return;
    setLoading(true); setError(null);
    try {
        const processedBase64 = await getProcessedImageBase64();
        const maskBase64 = getMaskBase64();
        
        // Use customPrompt combined with refinePrompt if any
        const fullPrompt = config.customPrompt + (refinePrompt ? `\nRefinement: ${refinePrompt}` : '');

        const output = await processImage(
            ToolType.PORTRAIT_EDITING,
            processedBase64,
            image.file.type,
            fullPrompt,
            { ...config, mask: maskBase64 || undefined },
            refImage?.base64
        );

        setResult(output);
        setRefinePrompt('');
        
        // History
        const historyItem: PortraitHistoryItem = {
            id: Date.now().toString(),
            originalImage: image.base64, // Store original, not processed
            resultImage: output,
            config: { ...config, customPrompt: fullPrompt },
            timestamp: Date.now()
        };
        setHistory(prev => [historyItem, ...prev]);

    } catch (err: any) {
        setError(err.message || t.common.error);
    } finally {
        setLoading(false);
    }
  };

  const handleProcessBatch = async () => {
      if (batchItems.length === 0) return;
      setLoading(true); setError(null);
      
      const newItems = [...batchItems];
      
      for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].status === 'done') continue;
          
          newItems[i].status = 'processing';
          setBatchItems([...newItems]);
          setProcessingStatus(`${t.common.processing} ${i + 1}/${newItems.length}`);
          
          try {
             // For batch, we assume adjustments apply to all, or no per-image adjustments yet
             // Reading file
             const base64 = await new Promise<string>((resolve) => {
                 const reader = new FileReader();
                 reader.onload = () => resolve(reader.result as string);
                 reader.readAsDataURL(newItems[i].file);
             });

             const output = await processImage(
                 ToolType.PORTRAIT_EDITING,
                 base64,
                 newItems[i].file.type,
                 config.customPrompt,
                 config // This ensures current config (style, adjustments, prompt) is used for all
             );

             newItems[i].resultUrl = output;
             newItems[i].status = 'done';
          } catch (e) {
             newItems[i].status = 'error';
          }
          setBatchItems([...newItems]);
      }
      setLoading(false);
      setProcessingStatus('');
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files) as File[];
          const newItems: BatchItem[] = files.map(f => ({
              id: Math.random().toString(36).substr(2, 9),
              file: f,
              previewUrl: URL.createObjectURL(f),
              status: 'pending'
          }));
          setBatchItems([...batchItems, ...newItems]);
      }
  };

  const handleDeleteBatchItem = (id: string) => {
      setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDownloadBatchZip = async () => {
      const completedItems = batchItems.filter(i => i.status === 'done' && i.resultUrl);
      if (completedItems.length === 0) return;

      setLoading(true);
      setProcessingStatus(t.portraitEditing.zipGenerating);

      try {
          const zip = new JSZip();
          
          for (let i = 0; i < completedItems.length; i++) {
              const item = completedItems[i];
              if (!item.resultUrl) continue;
              
              // Remove "data:image/png;base64," prefix
              const base64Data = item.resultUrl.split(',')[1];
              const fileName = `portrait_${item.file.name.split('.')[0]}.png`;
              
              zip.file(fileName, base64Data, {base64: true});
          }

          const blob = await zip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = "portrait_batch_results.zip";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

      } catch (e) {
          console.error("Zip generation failed", e);
          setError("Failed to generate zip file.");
      } finally {
          setLoading(false);
          setProcessingStatus('');
      }
  };

  // --- ACTIONS ---
  const handleReset = () => {
      setImage(null);
      setResult(null);
      setRefImage(null);
      setRefinePrompt('');
      setConfig(prev => ({
          ...prev,
          autoAdjust: false,
          adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, gamma: 1.0 },
          beauty: { ...prev.beauty, lipTint: { enabled: false, color: '#FF0000' } },
          customPrompt: ''
      }));
      setBatchItems([]); // Clear batch on reset
      // Clear canvas
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleRestore = (item: PortraitHistoryItem) => {
      setImage({ file: new File([], "restored"), base64: item.originalImage, width: 0, height: 0 }); // Dimensions will recalc in useEffect
      setResult(item.resultImage);
      setConfig(item.config);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={processingStatus || t.portraitEditing.loading} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.portraitEditing.panelTitle}
            </h3>

            {/* Mode */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.modeLabel}</label>
                <select 
                    value={config.mode} 
                    onChange={(e) => setConfig({...config, mode: e.target.value as any})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    <option value="single">{t.portraitEditing.modeSingle}</option>
                    <option value="batch">{t.portraitEditing.modeBatch}</option>
                </select>
            </div>

            {/* Adjustments */}
            <div className="space-y-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.adjTitle}</label>
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                        <input 
                            type="checkbox" 
                            checked={config.autoAdjust} 
                            onChange={(e) => handleAutoAdjust(e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500 bg-white dark:bg-slate-700"
                        />
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Wand2 size={10} /> {t.portraitEditing.adjAuto}
                        </span>
                    </label>
                </div>
                
                {[
                    { key: 'brightness', label: t.portraitEditing.adjBrightness, min: -100, max: 100 },
                    { key: 'contrast', label: t.portraitEditing.adjContrast, min: -100, max: 100 },
                    { key: 'saturation', label: t.portraitEditing.adjSaturation, min: -100, max: 100 },
                    { key: 'temperature', label: t.portraitEditing.adjTemperature, min: -100, max: 100 },
                ].map(adj => (
                    <div key={adj.key} className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{adj.label}</span>
                            <span>{config.adjustments[adj.key as keyof typeof config.adjustments]}</span>
                        </div>
                        <input 
                            type="range" min={adj.min} max={adj.max}
                            value={config.adjustments[adj.key as keyof typeof config.adjustments]}
                            onChange={(e) => handleSliderChange(adj.key as any, parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                ))}
            </div>

            {/* Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.styleLabel}</label>
                <select 
                    value={config.style}
                    onChange={(e) => setConfig({...config, style: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.entries(t.portraitEditing.styles).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                    ))}
                </select>
            </div>

            {/* Beauty */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.beautyTitle}</label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(t.portraitEditing.beautyFeatures).map(([key, label]) => {
                        // Skip rendering lipTint here, handle it separately below
                        if (key === 'lipTint') return null;
                        
                        return (
                            <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={config.beauty[key as keyof typeof config.beauty] as boolean}
                                    onChange={(e) => setConfig({
                                        ...config, 
                                        beauty: { ...config.beauty, [key]: e.target.checked }
                                    })}
                                    className="w-3.5 h-3.5 text-pink-600 rounded focus:ring-pink-500 bg-slate-100 dark:bg-slate-700"
                                />
                                <span className="text-xs text-slate-700 dark:text-slate-300">{label as string}</span>
                            </label>
                        );
                    })}
                </div>

                {/* Separated Lip Tint Control */}
                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={config.beauty.lipTint.enabled}
                            onChange={(e) => setConfig({
                                ...config, 
                                beauty: { 
                                    ...config.beauty, 
                                    lipTint: { ...config.beauty.lipTint, enabled: e.target.checked }
                                }
                            })}
                            className="w-3.5 h-3.5 text-red-600 rounded focus:ring-red-500 bg-slate-100 dark:bg-slate-700"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-300">{t.portraitEditing.beautyFeatures.lipTint}</span>
                    </label>
                    
                    {config.beauty.lipTint.enabled && (
                        <div className="mt-2 pl-6 animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Color</label>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={config.beauty.lipTint.color}
                                    onChange={(e) => setConfig({
                                        ...config, 
                                        beauty: { 
                                            ...config.beauty, 
                                            lipTint: { ...config.beauty.lipTint, color: e.target.value } 
                                        }
                                    })}
                                    className="h-8 w-8 p-0 border-0 rounded cursor-pointer" 
                                />
                                <input 
                                    type="text" 
                                    value={config.beauty.lipTint.color}
                                    onChange={(e) => setConfig({
                                        ...config, 
                                        beauty: { 
                                            ...config.beauty, 
                                            lipTint: { ...config.beauty.lipTint, color: e.target.value } 
                                        }
                                    })}
                                    className="flex-1 p-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 uppercase font-mono" 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Masking Tools (Single Mode Only) */}
            {config.mode === 'single' && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.portraitEditing.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.portraitEditing.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.portraitEditing.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>
                </div>
            )}

            {/* Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Quality</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">Standard</option>
                         <option value="enhance">Enhance</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Upscale</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.portraitEditing.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.portraitEditing.promptPlaceholder}
                    className="w-full p-2 h-16 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={config.mode === 'single' ? handleProcessSingle : handleProcessBatch}
                    disabled={loading || (config.mode === 'single' ? !image : batchItems.length === 0)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-base"
                >
                    {t.portraitEditing.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.portraitEditing.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.portraitEditing.btnExit}
                     </button>
                </div>
            </div>

            {/* History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.portraitEditing.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.resultImage} className="w-10 h-10 object-cover rounded" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">Edited Portrait</div>
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

       {/* --- CENTER: INPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">Before (Input Area)</div>
          <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-hidden">
              
              {/* Single Mode Display */}
              {config.mode === 'single' ? (
                  <div className="flex flex-col h-full gap-4">
                      {image ? (
                          <div className="relative flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group">
                              <div className="relative max-w-full max-h-full">
                                {/* Main Image with CSS Filters applied for live preview */}
                                <img 
                                    src={image.base64} 
                                    className="block max-w-full max-h-[calc(100vh-350px)] object-contain select-none" 
                                    style={{
                                        filter: `brightness(${100 + config.adjustments.brightness}%) contrast(${100 + config.adjustments.contrast}%) saturate(${100 + config.adjustments.saturation}%) hue-rotate(${-config.adjustments.temperature}deg)`
                                    }}
                                    alt="Main Portrait"
                                    draggable={false}
                                />
                                
                                {/* Masking Canvas Overlay */}
                                <canvas 
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={handleMouseLeave}
                                    onMouseEnter={handleMouseEnter}
                                    className={`absolute inset-0 w-full h-full cursor-none z-10 touch-none opacity-60`}
                                />

                                {/* Custom Circular Cursor */}
                                {showCursor && (
                                    <div 
                                        className={`fixed rounded-full border border-white z-50 pointer-events-none ${isEraser ? 'bg-white/30' : 'bg-red-500/30'}`}
                                        style={{
                                            left: cursorPos.x,
                                            top: cursorPos.y,
                                            width: brushSize, 
                                            height: brushSize,
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    />
                                )}
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

                      {/* Reference Image Upload */}
                      <div className="h-24 flex items-center justify-center border-t border-slate-200 dark:border-slate-700 pt-2">
                          {refImage ? (
                              <div className="relative h-full aspect-square rounded-lg overflow-hidden border">
                                  <img src={refImage.base64} className="h-full w-full object-cover" />
                                  <button onClick={() => setRefImage(null)} className="absolute top-0 right-0 bg-black/50 text-white p-0.5"><Trash2 size={12} /></button>
                              </div>
                          ) : (
                              <label className="cursor-pointer flex flex-col items-center gap-1 text-slate-400 hover:text-blue-500">
                                  <Plus size={20} />
                                  <span className="text-xs">{t.portraitEditing.refImageLabel}</span>
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                      if(e.target.files?.[0]) {
                                          const f = e.target.files[0];
                                          const r = new FileReader();
                                          r.onload = (ev) => setRefImage({file: f, base64: ev.target?.result as string});
                                          r.readAsDataURL(f);
                                      }
                                  }} />
                              </label>
                          )}
                      </div>
                  </div>
              ) : (
                  // Batch Mode Display
                  <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <label className="flex items-center justify-center gap-2 cursor-pointer bg-blue-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-700 transition-all">
                             <Upload size={18} /> {t.advancedRecolor.batchUpload}
                             <input type="file" multiple className="hidden" accept="image/*" onChange={handleBatchUpload} />
                        </label>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                         {batchItems.map((item, idx) => (
                             <div key={item.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                 <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
                                 <img src={item.previewUrl} className="w-10 h-10 object-cover rounded" />
                                 <div className="flex-1 min-w-0">
                                     <p className="text-xs font-bold truncate">{item.file.name}</p>
                                     <p className="text-[10px] text-slate-500">{(item.file.size / 1024).toFixed(1)} KB</p>
                                 </div>
                                 <button onClick={() => handleDeleteBatchItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                     <Trash2 size={16} />
                                 </button>
                             </div>
                         ))}
                         {batchItems.length === 0 && <div className="text-center text-slate-400 mt-20">{t.common.dragDrop}</div>}
                     </div>
                  </div>
              )}
          </div>
       </div>

       {/* --- RIGHT: OUTPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">After (Output Area)</div>
          <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
             
             {config.mode === 'single' ? (
                 result ? (
                     <div className="w-full h-full flex flex-col">
                         <div className="flex-1 p-4 flex items-center justify-center bg-white dark:bg-slate-900/50 overflow-hidden">
                             <img src={result} className="max-w-full max-h-[calc(100vh-350px)] object-contain shadow-2xl" />
                         </div>
                         <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                             <div className="flex gap-2">
                                 <input 
                                    type="text"
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    placeholder={t.portraitEditing.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleProcessSingle()}
                                 />
                                 <button onClick={handleProcessSingle} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                     <Send size={16} />
                                 </button>
                             </div>
                             <a href={result} download={`portrait_edited.png`} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                 <Download size={18} /> {t.common.download}
                             </a>
                         </div>
                     </div>
                 ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-400">
                         <p>{t.common.noResult}</p>
                     </div>
                 )
             ) : (
                 // Batch Result Table
                 <div className="w-full h-full flex flex-col">
                       <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                           <h4 className="font-bold text-sm">Batch Results</h4>
                           <button onClick={handleDownloadBatchZip} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold flex items-center gap-1">
                               <Download size={12} /> {t.portraitEditing.btnDownloadAll}
                           </button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-0">
                           <table className="w-full text-left text-xs">
                               <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold sticky top-0">
                                   <tr>
                                       <th className="p-3">{t.portraitEditing.batchTableFile}</th>
                                       <th className="p-3 w-20">{t.portraitEditing.batchTableBefore}</th>
                                       <th className="p-3 w-20">{t.portraitEditing.batchTableAfter}</th>
                                       <th className="p-3">{t.portraitEditing.batchTableStatus}</th>
                                       <th className="p-3 text-right">{t.portraitEditing.batchTableAction}</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                   {batchItems.map(item => (
                                       <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                           <td className="p-3 font-medium truncate max-w-[100px]">{item.file.name}</td>
                                           <td className="p-3">
                                               <img src={item.previewUrl} className="w-12 h-12 object-cover rounded border" alt="Before" />
                                           </td>
                                           <td className="p-3">
                                               {item.resultUrl ? (
                                                   <img src={item.resultUrl} className="w-12 h-12 object-cover rounded border border-green-500" alt="After" />
                                               ) : (
                                                   <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center text-slate-400">-</div>
                                               )}
                                           </td>
                                           <td className="p-3">
                                               {item.status === 'done' ? <span className="text-green-500 font-bold">Done</span> : item.status}
                                           </td>
                                           <td className="p-3 text-right">
                                               <div className="flex justify-end gap-2">
                                                   {item.resultUrl && (
                                                       <a href={item.resultUrl} download={`portrait_${item.file.name}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Download">
                                                           <Download size={14} />
                                                       </a>
                                                   )}
                                                   <button onClick={() => handleDeleteBatchItem(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                       <Trash2 size={14} />
                                                   </button>
                                               </div>
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                           {batchItems.length === 0 && <div className="p-10 text-center text-slate-400">No items</div>}
                       </div>
                   </div>
             )}
          </div>
       </div>

       {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default PortraitEditingTool;
