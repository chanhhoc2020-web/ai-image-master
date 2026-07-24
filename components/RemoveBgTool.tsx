import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, RemoveBgConfig, RemoveBgHistoryItem, BatchItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { Eraser, Brush, RefreshCcw, LogOut, ArrowRight, Download, Trash2, Plus, Upload, Save, CheckCircle, Loader2, AlertCircle, RotateCcw, Send, Layers } from 'lucide-react';
import JSZip from 'jszip';

interface RemoveBgToolProps {
  t: any;
}

const RemoveBgTool: React.FC<RemoveBgToolProps> = ({ t }) => {
  // --- STATE ---
  
  // Single Mode
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  const [result, setResult] = useState<string | null>(null);
  
  // Batch Mode
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // Config
  const [config, setConfig] = useState<RemoveBgConfig>({
    mode: 'single',
    lightBalance: false,
    denoise: false,
    antiAlias: false,
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // History
  const [history, setHistory] = useState<RemoveBgHistoryItem[]>([]);

  // Masking
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setResult(null);
        // Reset mask
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
          files.forEach((file: File) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  setAdditionalAssets(prev => [...prev, {
                      id: Math.random().toString(),
                      file,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file);
          });
      }
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
    // Use red for visualizing the mask (will be converted to white for AI)
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : 'rgba(255, 0, 0, 0.6)'; 
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
      // Convert to binary mask: Red pixels -> White, Transparent -> Black
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return null;

      // Fill background black
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Get mask data
      const srcCtx = canvasRef.current.getContext('2d');
      const srcData = srcCtx!.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
      
      // Create binary mask
      const imgData = ctx.createImageData(tempCanvas.width, tempCanvas.height);
      const data = imgData.data;
      let hasPixels = false;

      for (let i = 0; i < srcData.length; i += 4) {
          // If pixel has alpha (drawn), make it white
          if (srcData[i+3] > 0) {
              data[i] = 255;   // R
              data[i+1] = 255; // G
              data[i+2] = 255; // B
              data[i+3] = 255; // A
              hasPixels = true;
          } else {
              data[i] = 0;
              data[i+1] = 0;
              data[i+2] = 0;
              data[i+3] = 255;
          }
      }

      if (!hasPixels) return null; // Empty mask

      ctx.putImageData(imgData, 0, 0);
      return tempCanvas.toDataURL('image/png');
  };

  // --- RESIZE HELPER ---
  const resizeImage = async (
      imageSrc: string, 
      scaleMode: string,
      originalW: number,
      originalH: number
  ): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                  resolve(imageSrc);
                  return;
              }

              // Determine target dimensions
              let targetW = originalW;
              let targetH = originalH;

              switch (scaleMode) {
                  case 'x2':
                      targetW = originalW * 2;
                      targetH = originalH * 2;
                      break;
                  case 'x4':
                      targetW = originalW * 4;
                      targetH = originalH * 4;
                      break;
                  case 'ultra_hd':
                      // Logic: Scale so the largest dimension is 3840px (standard 4K wide)
                      const aspectRatio = originalW / originalH;
                      if (originalW > originalH) {
                          targetW = 3840;
                          targetH = 3840 / aspectRatio;
                      } else {
                          targetH = 3840;
                          targetW = 3840 * aspectRatio;
                      }
                      break;
                  case 'x1':
                  default:
                      targetW = originalW;
                      targetH = originalH;
                      break;
              }

              canvas.width = targetW;
              canvas.height = targetH;

              // Use high quality scaling
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              ctx.drawImage(img, 0, 0, targetW, targetH);
              resolve(canvas.toDataURL('image/png', 1.0));
          };
          img.onerror = (e) => reject(e);
          img.src = imageSrc;
      });
  };

  // --- PROCESS ---

  const handleProcessSingle = async () => {
    if (!image) return;
    setLoading(true); setError(null);
    try {
        const mask = getMaskBase64();
        
        // Auto-enhance prompt if mask and assets are present to ensure correct behavior
        let autoPrompt = config.customPrompt;
        if (mask && additionalAssets.length > 0 && !autoPrompt.toLowerCase().includes('mask')) {
            autoPrompt += " (Note: I have painted the target area in red/white. Place the reference object exactly there.)";
        }

        const fullPrompt = autoPrompt + (refinePrompt ? `\nRefinement: ${refinePrompt}` : '');

        const output = await processImage(
            ToolType.REMOVE_BG,
            image.base64,
            image.file.type,
            fullPrompt,
            { ...config, mask: mask || undefined },
            additionalAssets.map(a => a.base64)
        );

        setResult(output);
        setRefinePrompt('');
        
        // Save History
        const historyItem: RemoveBgHistoryItem = {
            id: Date.now().toString(),
            originalImage: image.base64,
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
             const base64 = await new Promise<string>((resolve) => {
                 const reader = new FileReader();
                 reader.onload = () => resolve(reader.result as string);
                 reader.readAsDataURL(newItems[i].file);
             });

             const output = await processImage(
                 ToolType.REMOVE_BG,
                 base64,
                 newItems[i].file.type,
                 config.customPrompt,
                 config // No mask in batch
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

  // --- DOWNLOAD HANDLERS (WITH UPSCALE LOGIC) ---

  const handleDownloadSingle = async () => {
      if (!result || !image) return;
      
      // Perform client-side upscaling if needed before download
      const finalImage = await resizeImage(result, config.upscale, image.width, image.height);
      
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = `remove_bg_${config.upscale}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadBatchItem = async (item: BatchItem) => {
      if (!item.resultUrl) return;
      
      // We need to get original dimensions from the file
      const img = new Image();
      const objectUrl = URL.createObjectURL(item.file);
      img.src = objectUrl;
      await new Promise(r => img.onload = r);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);

      const finalImage = await resizeImage(item.resultUrl, config.upscale, w, h);
      
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = `removed_bg_${item.file.name.split('.')[0]}_${config.upscale}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files);
          const newItems: BatchItem[] = files.map((f: File) => ({
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

              // Get Dimensions
              const img = new Image();
              const objectUrl = URL.createObjectURL(item.file);
              img.src = objectUrl;
              await new Promise(r => img.onload = r);
              const w = img.naturalWidth;
              const h = img.naturalHeight;
              URL.revokeObjectURL(objectUrl);

              // Resize/Upscale
              const finalBase64 = await resizeImage(item.resultUrl, config.upscale, w, h);
              const base64Data = finalBase64.split(',')[1];
              const fileName = `bg_removed_${item.file.name.split('.')[0]}.png`;
              
              zip.file(fileName, base64Data, {base64: true});
          }
          const blob = await zip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `batch_bg_remove_${config.upscale}.zip`;
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

  const handleReset = () => {
      setImage(null);
      setResult(null);
      setAdditionalAssets([]);
      setBatchItems([]);
      setConfig({
        mode: 'single',
        lightBalance: false,
        denoise: false,
        antiAlias: false,
        quality: 'keep_original',
        upscale: 'x1',
        customPrompt: ''
      });
      setRefinePrompt('');
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleRestore = (item: RemoveBgHistoryItem) => {
      setImage({ file: new File([], "restored"), base64: item.originalImage, width: 0, height: 0 }); // Size resets on load
      setResult(item.resultImage);
      setConfig(item.config);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={processingStatus || t.removeBg.loading} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Eraser className="text-indigo-500" />
                {t.removeBg.panelTitle}
            </h3>

            {/* 1. Mode */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.removeBg.modeLabel}</label>
                <select 
                    value={config.mode} 
                    onChange={(e) => setConfig({...config, mode: e.target.value as any})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    <option value="single">{t.removeBg.modeSingle}</option>
                    <option value="batch">{t.removeBg.modeBatch}</option>
                </select>
            </div>

            {/* 2. Masking (Single Only) */}
            {config.mode === 'single' && image && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.removeBg.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.removeBg.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.removeBg.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.removeBg.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>
                </div>
            )}

            {/* 3. Enhancements */}
            <div className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.removeBg.beautyTitle}</label>
                <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={config.lightBalance} onChange={(e) => setConfig({...config, lightBalance: e.target.checked})} className="rounded text-indigo-600" />
                        <span className="text-sm">{t.removeBg.enhanceLight}</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={config.denoise} onChange={(e) => setConfig({...config, denoise: e.target.checked})} className="rounded text-indigo-600" />
                        <span className="text-sm">{t.removeBg.denoise}</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={config.antiAlias} onChange={(e) => setConfig({...config, antiAlias: e.target.checked})} className="rounded text-indigo-600" />
                        <span className="text-sm">{t.removeBg.antiAlias}</span>
                    </label>
                </div>
            </div>

            {/* 4. Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.removeBg.qualityLabel}</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">{t.removeBg.qualityKeep}</option>
                         <option value="enhance">{t.removeBg.qualityEnhance}</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.removeBg.upscaleLabel}</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* 6. Custom Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.removeBg.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.removeBg.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* 7. Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={config.mode === 'single' ? handleProcessSingle : handleProcessBatch}
                    disabled={loading || (config.mode === 'single' ? !image : batchItems.length === 0)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg text-base"
                >
                    {t.removeBg.btnProcess} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.removeBg.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.removeBg.btnExit}
                     </button>
                </div>
            </div>

            {/* 8. History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.removeBg.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.resultImage} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">Removed BG</div>
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
            <div className="font-bold text-xl text-slate-500 uppercase px-1">{t.removeBg.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                
                {config.mode === 'single' ? (
                    <div className="flex-1 flex flex-col min-h-[300px] mb-4">
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

                        {/* Additional Assets */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Plus size={16} /> {t.removeBg.uploadAssets}
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
                ) : (
                    // BATCH INPUT TABLE
                    <div className="w-full h-full flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <label className="flex items-center justify-center gap-2 cursor-pointer bg-blue-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-700 transition-all">
                                 <Upload size={18} /> {t.advancedRecolor.batchUpload}
                                 <input type="file" multiple className="hidden" accept="image/*" onChange={handleBatchUpload} />
                            </label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                             {batchItems.map((item, idx) => (
                                 <div key={item.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-20">
                                     <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
                                     <img src={item.previewUrl} className="w-16 h-16 object-cover rounded" />
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

        {/* --- RIGHT: OUTPUT AREA --- */}
        <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
            <div className="font-bold text-xl text-slate-500 uppercase px-1">{t.removeBg.outputArea}</div>
            <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                
                {config.mode === 'single' ? (
                    result ? (
                        <div className="w-full h-full flex flex-col">
                            <div className="flex-1 p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] overflow-hidden relative">
                                <img src={result} className="w-full h-full object-contain shadow-2xl" />
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                                {/* Refine */}
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={refinePrompt}
                                        onChange={(e) => setRefinePrompt(e.target.value)}
                                        placeholder={t.removeBg.refinePlaceholder}
                                        className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                        onKeyDown={(e) => e.key === 'Enter' && handleProcessSingle()}
                                    />
                                    <button onClick={handleProcessSingle} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                        <Send size={16} />
                                    </button>
                                </div>
                                <button 
                                    onClick={handleDownloadSingle}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Download size={18} /> {t.common.download} ({config.upscale.toUpperCase()})
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <p>{t.common.noResult}</p>
                        </div>
                    )
                ) : (
                    // BATCH OUTPUT TABLE
                    <div className="w-full h-full flex flex-col">
                       <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center h-[72px]">
                           <h4 className="font-bold text-sm">Batch Results</h4>
                           <button onClick={handleDownloadBatchZip} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold flex items-center gap-1">
                               <Download size={12} /> {t.removeBg.btnSaveAll}
                           </button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                           {batchItems.map((item, idx) => (
                               <div key={item.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-20">
                                   <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
                                   <div className="w-16 h-16 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded">
                                       {item.resultUrl ? (
                                           <img src={item.resultUrl} className="w-full h-full object-cover rounded border border-green-500" />
                                       ) : (
                                           <span className="text-xs text-slate-400">-</span>
                                       )}
                                   </div>
                                   <div className="flex-1 min-w-0 px-2">
                                       {item.status === 'done' ? <span className="text-green-500 font-bold text-xs flex items-center gap-1"><CheckCircle size={12}/> Done</span> : 
                                        item.status === 'processing' ? <span className="text-blue-500 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Processing</span> :
                                        item.status === 'error' ? <span className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12}/> Error</span> :
                                        <span className="text-slate-400 text-xs">Pending</span>
                                       }
                                   </div>
                                   <div className="flex gap-1">
                                       {item.resultUrl && (
                                           <button onClick={() => handleDownloadBatchItem(item)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title={t.removeBg.btnSave}>
                                               <Save size={16} />
                                           </button>
                                       )}
                                       <button onClick={() => handleDeleteBatchItem(item.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title={t.removeBg.btnDelete}>
                                           <Trash2 size={16} />
                                       </button>
                                   </div>
                               </div>
                           ))}
                           {batchItems.length === 0 && <div className="text-center text-slate-400 mt-20">{t.common.noResult}</div>}
                       </div>
                   </div>
                )}
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default RemoveBgTool;