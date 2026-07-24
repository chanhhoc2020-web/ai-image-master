
import React, { useState, useRef, useEffect } from 'react';
import { ToolType, AdvancedRecolorConfig, BatchItem, AdvancedRecolorHistoryItem, ColorMapping } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { Eraser, Undo, Trash2, ArrowRight, Download, Brush, Image as ImageIcon, Palette, Hash, Upload, PlusCircle, CheckCircle, AlertCircle, Loader2, RefreshCcw, LogOut, RotateCcw, MousePointer2, Plus, X, Pipette, Send } from 'lucide-react';

interface AdvancedRecolorToolProps {
  t: any;
}

// Simple color palette
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#000000', '#ffffff', '#9ca3af', '#78350f'
];

const AdvancedRecolorTool: React.FC<AdvancedRecolorToolProps> = ({ t }) => {
  // CONFIG STATE
  const [config, setConfig] = useState<AdvancedRecolorConfig>({
    mode: 'single',
    colorSource: 'hex',
    targetColor: '#3b82f6',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: '',
    colorMappings: []
  });

  // SINGLE MODE STATE
  const [singleImage, setSingleImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [refImage, setRefImage] = useState<{file: File, base64: string} | null>(null);
  const [singleResult, setSingleResult] = useState<string | null>(null);
  
  // Brush State
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [historyMask, setHistoryMask] = useState<ImageData[]>([]);
  
  // Point Mapping State
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<'source' | 'target' | null>(null); // 'source' = pick from main img, 'target' = pick from ref img

  // Refine Result State
  const [refinePrompt, setRefinePrompt] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // BATCH MODE STATE
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // HISTORY STATE
  const [history, setHistory] = useState<AdvancedRecolorHistoryItem[]>([]);

  // COMMON STATE
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // --- HELPER: RGB to HEX ---
  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  };

  const getPixelColor = (x: number, y: number, imgElement: HTMLImageElement | HTMLCanvasElement): string | null => {
      const canvas = document.createElement('canvas');
      
      // Fix: Check for naturalWidth/Height on Image elements to get correct resolution
      const width = (imgElement instanceof HTMLImageElement) ? imgElement.naturalWidth : imgElement.width;
      const height = (imgElement instanceof HTMLImageElement) ? imgElement.naturalHeight : imgElement.height;

      if (width === 0 || height === 0) return null;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(imgElement as any, 0, 0, width, height);
      try {
        const p = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return rgbToHex(p[0], p[1], p[2]);
      } catch (e) {
        return null;
      }
  };

  // --- SINGLE MODE: IMAGE & CANVAS LOGIC ---
  const handleSingleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSingleImage({
          file,
          base64: e.target?.result as string,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        setHistoryMask([]); 
        setSingleResult(null);
        setRefinePrompt('');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (singleImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = singleImage.width;
      canvas.height = singleImage.height;
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [singleImage]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, scale: 1 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scale: scaleX 
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Logic used ONLY when picking colors from source image
      if (config.colorSource === 'point_mapping' && activeMappingId && pickMode === 'source' && singleImage) {
          const coords = getCanvasCoordinates(e);
          
          // Use a temporary image object to get color (since canvas only has mask)
          const img = new Image();
          img.src = singleImage.base64;
          img.onload = () => {
              const color = getPixelColor(coords.x, coords.y, img);
              if (color) {
                  updateMapping(activeMappingId, { sourceColor: color, sourceCoords: { x: coords.x, y: coords.y } });
                  // If ref image exists, auto switch to target picking
                  if (refImage) {
                      setPickMode('target');
                  } else {
                      setPickMode(null);
                  }
              }
          };
      }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Disable drawing if in picking mode
    if (config.colorSource === 'point_mapping' && pickMode) return;

    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'; 
    } else {
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; 
    }
    ctx.lineWidth = brushSize * coords.scale; 
    setHistoryMask([...historyMask, ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    
    // Disable drawing if in picking mode
    if (config.colorSource === 'point_mapping' && pickMode) return;

    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const coords = getCanvasCoordinates(e);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       ctx?.closePath();
       ctx.globalCompositeOperation = 'source-over';
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
     if (!canvasRef.current) return;
     const ctx = canvasRef.current.getContext('2d');
     ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
     setHistoryMask([]);
  };

  const getMaskAsBase64 = (): string | null => {
      if (!canvasRef.current) return null;
      // Convert visible canvas to binary mask
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return null;
      tCtx.fillStyle = 'black';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      const mainCtx = canvasRef.current.getContext('2d');
      if (!mainCtx) return null;
      const mainData = mainCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
      const targetImgData = tCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const targetData = targetImgData.data;
      for (let i = 0; i < mainData.length; i += 4) {
          if (mainData[i+3] > 10) { 
             targetData[i] = 255; targetData[i+1] = 255; targetData[i+2] = 255; targetData[i+3] = 255; 
          } else {
             targetData[i] = 0; targetData[i+1] = 0; targetData[i+2] = 0; targetData[i+3] = 255; 
          }
      }
      tCtx.putImageData(targetImgData, 0, 0);
      return tempCanvas.toDataURL('image/png');
  };

  // --- EYEDROPPER ---
  const handleEyeDropper = async () => {
    if (!window.EyeDropper) { alert("Trình duyệt không hỗ trợ."); return; }
    try {
      const result = await new window.EyeDropper().open();
      setConfig({...config, targetColor: result.sRGBHex});
    } catch (e) {}
  };

  // --- POINT MAPPING LOGIC ---

  const addMapping = () => {
      const newMapping: ColorMapping = {
          id: Date.now().toString(),
          sourceColor: '#FFFFFF',
          targetColor: '#000000',
          sourceCoords: undefined
      };
      const newMappings = [...(config.colorMappings || []), newMapping];
      setConfig({...config, colorMappings: newMappings});
      setActiveMappingId(newMapping.id);
      setPickMode('source'); // Start by picking source
  };

  const removeMapping = (id: string) => {
      const newMappings = config.colorMappings?.filter(m => m.id !== id) || [];
      setConfig({...config, colorMappings: newMappings});
      if (activeMappingId === id) {
          setActiveMappingId(null);
          setPickMode(null);
      }
  };

  const updateMapping = (id: string, updates: Partial<ColorMapping>) => {
      const newMappings = config.colorMappings?.map(m => m.id === id ? { ...m, ...updates } : m) || [];
      setConfig({...config, colorMappings: newMappings});
  };

  const handleRefImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
      if (config.colorSource === 'point_mapping' && activeMappingId && pickMode === 'target') {
         const img = e.currentTarget;
         const rect = img.getBoundingClientRect();
         
         // Fix: Handle object-contain coordinate mapping
         // This is crucial because standard offset math fails when object-contain adds padding
         const imageAspect = img.naturalWidth / img.naturalHeight;
         const rectAspect = rect.width / rect.height;
         
         let renderWidth, renderHeight, offsetX, offsetY;
         
         if (imageAspect > rectAspect) {
             // Image is wider than container
             renderWidth = rect.width;
             renderHeight = rect.width / imageAspect;
             offsetX = 0;
             offsetY = (rect.height - renderHeight) / 2;
         } else {
             // Image is taller than container
             renderHeight = rect.height;
             renderWidth = rect.height * imageAspect;
             offsetX = (rect.width - renderWidth) / 2;
             offsetY = 0;
         }

         const clientX = e.clientX - rect.left;
         const clientY = e.clientY - rect.top;

         // Check if click is inside the actual rendered image area
         if (clientX < offsetX || clientX > offsetX + renderWidth || 
             clientY < offsetY || clientY > offsetY + renderHeight) {
             return; // Clicked on the padding area, ignore
         }

         // Map to natural coordinates
         const x = (clientX - offsetX) * (img.naturalWidth / renderWidth);
         const y = (clientY - offsetY) * (img.naturalHeight / renderHeight);

         const color = getPixelColor(x, y, img);
         if (color) {
             updateMapping(activeMappingId, { targetColor: color });
             setPickMode(null); // Finish picking sequence
         }
      }
  };

  // --- ACTIONS ---

  const handleReset = () => {
    setSingleImage(null);
    setSingleResult(null);
    setRefImage(null);
    setConfig({
        mode: 'single',
        colorSource: 'hex',
        targetColor: '#3b82f6',
        quality: 'keep_original',
        upscale: 'x1',
        customPrompt: '',
        colorMappings: []
    });
    setHistoryMask([]);
    setActiveMappingId(null);
    setPickMode(null);
    setRefinePrompt('');
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleRestore = (item: AdvancedRecolorHistoryItem) => {
      // Restore image state from history
      setSingleImage({
          file: new File([], "restored_image"),
          base64: item.originalImage,
          width: 0, // Will be recalculated by useEffect
          height: 0
      });
      setSingleResult(item.resultImage);
      setConfig(item.config);
      setRefinePrompt('');
  };

  // --- PROCESSING LOGIC ---

  const handleProcessSingle = async () => {
    if (!singleImage) return;
    setLoading(true); setError(null);
    try {
        const mask = getMaskAsBase64();
        // If mask is empty (black), we warn but proceed if prompt exists
        // Logic: if mask is present, use it.
        const output = await processImage(
            ToolType.ADVANCED_RECOLOR,
            singleImage.base64,
            singleImage.file.type,
            config.customPrompt,
            { ...config, mask: mask || undefined },
            refImage?.base64
        );
        
        // Save to history
        const newItem: AdvancedRecolorHistoryItem = {
            id: Date.now().toString(),
            originalImage: singleImage.base64,
            resultImage: output,
            config: { ...config },
            prompt: config.customPrompt,
            timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev]);
        setSingleResult(output);
    } catch (err: any) {
        setError(err.message || t.common.error);
    } finally {
        setLoading(false);
    }
  };

  const handleRefine = () => {
    if (!refinePrompt.trim()) return;
    // Update the custom prompt with the new refinement and re-process
    // We append the refinement to the existing prompt or set it as new
    const updatedPrompt = `${config.customPrompt} \n\n Refinement: ${refinePrompt}`;
    setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));
    // Trigger process with the original image + updated prompt
    // Note: We need to use setTimeout to allow state to update, or just pass updated config directly
    
    // Direct call with updated config to avoid race condition
    setLoading(true); setError(null);
    (async () => {
      try {
        const mask = getMaskAsBase64();
        const output = await processImage(
          ToolType.ADVANCED_RECOLOR,
          singleImage!.base64,
          singleImage!.file.type,
          updatedPrompt, 
          { ...config, customPrompt: updatedPrompt, mask: mask || undefined },
          refImage?.base64
        );
        
        setSingleResult(output);
        // We don't necessarily add every small refinement to history to keep it clean, 
        // or we can if desired. Let's just update the result.
      } catch (err: any) {
        setError(err.message || t.common.error);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleProcessBatch = async () => {
      if (batchItems.length === 0) return;
      setLoading(true); setError(null);
      
      const newItems = [...batchItems];
      
      for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].status === 'done') continue;
          
          newItems[i].status = 'processing';
          setBatchItems([...newItems]);
          setProcessingStatus(`Processing ${i + 1}/${newItems.length}...`);
          
          try {
             // Read file as base64
             const base64 = await new Promise<string>((resolve) => {
                 const reader = new FileReader();
                 reader.onload = () => resolve(reader.result as string);
                 reader.readAsDataURL(newItems[i].file);
             });

             const output = await processImage(
                 ToolType.ADVANCED_RECOLOR,
                 base64,
                 newItems[i].file.type,
                 config.customPrompt, // Batch depends heavily on prompt
                 { ...config, mask: undefined }, // No manual mask in batch
                 refImage?.base64
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

  const handleDownloadAll = () => {
      batchItems.forEach(item => {
          if (item.status === 'done' && item.resultUrl) {
              const link = document.createElement('a');
              link.href = item.resultUrl;
              link.download = `recolored_${item.file.name.split('.')[0]}.png`;
              link.click();
          }
      });
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
      {loading && <LoadingOverlay message={processingStatus || t.advancedRecolor.loading} t={t} />}

      {/* --- LEFT COLUMN: CONTROL PANEL --- */}
      <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
          <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
             <Palette className="text-pink-500" />
             {t.advancedRecolor.panelTitle}
          </h3>

          {/* Mode */}
          <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">{t.advancedRecolor.processMode}</label>
              <select 
                  value={config.mode} 
                  onChange={(e) => setConfig({...config, mode: e.target.value as 'single' | 'batch'})}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
              >
                  <option value="single">{t.advancedRecolor.modeSingle}</option>
                  <option value="batch">{t.advancedRecolor.modeBatch}</option>
              </select>
          </div>

          {/* BRUSH (Single Mode Only) */}
          {config.mode === 'single' && (
              <div className="space-y-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-bold uppercase text-slate-500">{t.advancedRecolor.brushTitle}</label>
                  <div className="flex gap-2">
                      <button onClick={() => setIsEraser(false)} disabled={!!pickMode} className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700 disabled:opacity-50'}`}>
                          <Brush size={14} /> {t.advancedRecolor.brushPaint}
                      </button>
                      <button onClick={() => setIsEraser(true)} disabled={!!pickMode} className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700 disabled:opacity-50'}`}>
                          <Eraser size={14} /> {t.advancedRecolor.brushErase}
                      </button>
                  </div>
                  <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                          <span>{t.advancedRecolor.brushSize}</span>
                          <span>{brushSize}px</span>
                      </div>
                      <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                  </div>
              </div>
          )}

          {/* Color Source */}
          <div className="space-y-3">
              <label className="text-xs font-bold uppercase text-slate-500">{t.advancedRecolor.colorSampleTitle}</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                      { id: 'ref_image', icon: ImageIcon, label: 'Ảnh' },
                      { id: 'hex', icon: Hash, label: 'Mã' },
                      { id: 'palette', icon: Palette, label: 'Bảng' },
                      { id: 'point_mapping', icon: MousePointer2, label: 'Đa điểm' }
                  ].map(item => (
                      <button 
                        key={item.id}
                        onClick={() => setConfig({...config, colorSource: item.id as any})}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] transition-all ${config.colorSource === item.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                      >
                          <item.icon size={16} className="mb-1" />
                          {item.label}
                      </button>
                  ))}
              </div>

              {/* Dynamic Color Inputs */}
              {(config.colorSource === 'ref_image' || config.colorSource === 'point_mapping') && (
                  <div className="flex flex-col gap-2">
                       <label className="w-full cursor-pointer bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 p-2 rounded-lg text-xs text-center hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                           <Upload size={14} />
                           {t.advancedRecolor.uploadRefPlaceholder}
                           <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                               const file = e.target.files?.[0];
                               if(file) {
                                   const reader = new FileReader();
                                   reader.onloadend = () => setRefImage({file, base64: reader.result as string});
                                   reader.readAsDataURL(file);
                               }
                           }} />
                       </label>
                       {refImage && (
                         <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden group">
                           <img 
                              src={refImage.base64} 
                              className={`w-full max-h-32 object-contain bg-slate-100 dark:bg-black/20 ${pickMode === 'target' ? 'cursor-crosshair' : ''}`} 
                              onClick={handleRefImageClick}
                              alt="Reference"
                           />
                           {pickMode === 'target' && (
                             <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center pointer-events-none">
                               <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow animate-bounce">Pick Target Color</span>
                             </div>
                           )}
                         </div>
                       )}
                  </div>
              )}

              {config.colorSource === 'point_mapping' && (
                  <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-500">Mappings</label>
                          <button onClick={addMapping} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
                             <Plus size={12} /> Add
                          </button>
                      </div>
                      
                      {config.colorMappings?.map((mapping, idx) => (
                          <div key={mapping.id} className={`p-2 rounded-lg border text-xs space-y-2 ${activeMappingId === mapping.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                              <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-600">Mẫu {idx + 1}</span>
                                  <button onClick={() => removeMapping(mapping.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                      <X size={12} />
                                  </button>
                              </div>
                              <div className="flex items-center gap-2">
                                  {/* Source Color Picker */}
                                  <div className="flex-1">
                                      <div className="mb-1 text-[10px] text-slate-500">Màu Gốc</div>
                                      <div className="flex gap-1 items-center">
                                          <div className="w-6 h-6 rounded border shadow-sm" style={{backgroundColor: mapping.sourceColor}}></div>
                                          <button 
                                            onClick={() => { setActiveMappingId(mapping.id); setPickMode('source'); }}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border ${activeMappingId === mapping.id && pickMode === 'source' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50 border-slate-300'}`}
                                          >
                                              <Pipette size={10} /> Pick
                                          </button>
                                      </div>
                                  </div>
                                  
                                  <ArrowRight size={12} className="text-slate-400 mt-4" />

                                  {/* Target Color Picker */}
                                  <div className="flex-1">
                                      <div className="mb-1 text-[10px] text-slate-500">Màu Đích</div>
                                      <div className="flex gap-1 items-center">
                                          <div className="w-6 h-6 rounded border shadow-sm" style={{backgroundColor: mapping.targetColor}}></div>
                                          {refImage ? (
                                              <button 
                                                onClick={() => { setActiveMappingId(mapping.id); setPickMode('target'); }}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border ${activeMappingId === mapping.id && pickMode === 'target' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-300'}`}
                                              >
                                                  <Pipette size={10} /> Pick
                                              </button>
                                          ) : (
                                              <input type="color" className="w-8 h-6 p-0 border-0" value={mapping.targetColor} onChange={(e) => updateMapping(mapping.id, {targetColor: e.target.value})} />
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {(!config.colorMappings || config.colorMappings.length === 0) && (
                          <div className="text-center text-xs text-slate-400 py-2 border border-dashed rounded-lg">
                              Click (+ Add) để thêm cặp màu
                          </div>
                      )}
                  </div>
              )}

              {config.colorSource === 'hex' && (
                  <div className="flex gap-2">
                      <input type="color" value={config.targetColor} onChange={(e) => setConfig({...config, targetColor: e.target.value})} className="h-9 w-9 p-0 border-0 rounded cursor-pointer" />
                      <input type="text" value={config.targetColor} onChange={(e) => setConfig({...config, targetColor: e.target.value})} className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                  </div>
              )}

              {config.colorSource === 'palette' && (
                  <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map(c => (
                          <div 
                            key={c} 
                            onClick={() => setConfig({...config, targetColor: c})}
                            className={`w-6 h-6 rounded-full cursor-pointer shadow-sm ${config.targetColor === c ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                      ))}
                      <button onClick={handleEyeDropper} className="w-6 h-6 rounded-full bg-white border flex items-center justify-center" title="Pipette">
                          <Palette size={12} className="text-slate-600" />
                      </button>
                  </div>
              )}
          </div>

          {/* Quality & Upscale */}
          <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-500">{t.advancedRecolor.qualityLabel}</label>
                   <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600">
                       <option value="keep_original">{t.advancedRecolor.qualityKeep}</option>
                       <option value="enhance">{t.advancedRecolor.qualityEnhance}</option>
                   </select>
               </div>
               <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-500">{t.advancedRecolor.upscaleLabel}</label>
                   <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600">
                       <option value="x1">X1</option>
                       <option value="x2">X2</option>
                       <option value="x4">X4</option>
                       <option value="ultra_hd">Ultra HD</option>
                   </select>
               </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-slate-500">{t.advancedRecolor.promptLabel}</label>
               <textarea 
                  value={config.customPrompt} 
                  onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                  placeholder={t.advancedRecolor.promptPlaceholder}
                  className="w-full p-3 h-20 text-sm border rounded-lg resize-none dark:bg-slate-800 dark:border-slate-600"
               />
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button 
                onClick={config.mode === 'single' ? handleProcessSingle : handleProcessBatch}
                disabled={loading || (config.mode === 'single' ? !singleImage : batchItems.length === 0)}
                className="w-full py-3 text-base shadow-lg shadow-pink-500/20 bg-pink-600 hover:bg-pink-700"
            >
                {t.advancedRecolor.btnStart} <ArrowRight size={18} className="ml-2" />
            </Button>

            <div className="grid grid-cols-2 gap-3">
                 <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <RefreshCcw size={16} /> {t.advancedRecolor.btnReset}
                 </button>
                 <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <LogOut size={16} /> {t.advancedRecolor.btnExit}
                 </button>
            </div>
          </div>

          {/* History Section */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-500 dark:text-slate-400 uppercase mb-3">{t.advancedRecolor.historyTitle}</h4>
                <div className="space-y-3">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.resultImage} className="w-12 h-12 object-cover rounded" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">
                                    {item.config.mode === 'single' ? 'Single Edit' : 'Batch Edit'}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">{new Date(item.timestamp).toLocaleTimeString()}</div>
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
                    {history.length === 0 && <p className="text-xs text-slate-400 italic">{t.advancedRecolor.emptyHistory}</p>}
                </div>
          </div>

      </div>

      {/* --- CENTER COLUMN: INPUT AREA --- */}
      <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.advancedRecolor.inputArea}</div>
          
          <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col relative overflow-hidden">
             
             {/* SINGLE MODE DISPLAY */}
             {config.mode === 'single' && (
                 singleImage ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 p-4">
                        <div className={`relative shadow-2xl ${pickMode === 'source' ? 'cursor-crosshair' : ''}`}>
                             <img src={singleImage.base64} className="max-w-full max-h-[calc(100vh-250px)] block select-none pointer-events-none" draggable={false} />
                             <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onClick={handleCanvasClick}
                                className={`absolute inset-0 w-full h-full z-10 touch-none opacity-60 ${pickMode ? 'cursor-crosshair' : (isEraser ? 'cursor-cell' : 'cursor-crosshair')}`}
                             />
                        </div>
                        {/* Cursor */}
                        {!pickMode && (
                            <div 
                                className={`fixed rounded-full border-2 z-50 pointer-events-none ${isEraser ? 'border-white bg-white/20' : 'border-red-500 bg-red-500/20'}`}
                                style={{
                                    width: brushSize, height: brushSize,
                                    left: 0, top: 0,
                                    transform: `translate(${cursorPos.x + (canvasRef.current?.getBoundingClientRect().left||0) - brushSize/2}px, ${cursorPos.y + (canvasRef.current?.getBoundingClientRect().top||0) - brushSize/2}px)`,
                                    opacity: cursorPos.x > -50 ? 1 : 0
                                }}
                            />
                        )}
                        {/* Picking Mode Indicator */}
                        {pickMode === 'source' && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 animate-bounce z-50 pointer-events-none">
                                 <MousePointer2 size={16} /> Pick Source Color from Image
                             </div>
                        )}
                        <button onClick={clearCanvas} className="absolute top-4 right-4 bg-white/80 p-2 rounded-full text-red-500 hover:bg-red-50 z-20">
                            <Trash2 size={16} />
                        </button>
                    </div>
                 ) : (
                    <div className="w-full h-full p-10 flex flex-col items-center justify-center">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                            if(e.target.files?.[0]) handleSingleImageUpload(e.target.files[0]);
                        }} />
                        <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 text-slate-400 hover:text-blue-500 transition-colors">
                            <PlusCircle size={48} strokeWidth={1} />
                            <span className="font-medium">{t.common.dragDrop}</span>
                        </button>
                    </div>
                 )
             )}

             {/* BATCH MODE DISPLAY (Drop Zone + List) */}
             {config.mode === 'batch' && (
                 <div className="w-full h-full flex flex-col">
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
                                 <div className="w-24 text-right">
                                    {item.status === 'pending' && <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{t.advancedRecolor.statusPending}</span>}
                                    {item.status === 'processing' && <span className="text-xs text-blue-500 flex items-center justify-end gap-1"><Loader2 size={12} className="animate-spin" /> Processing</span>}
                                    {item.status === 'done' && <span className="text-xs text-green-500 flex items-center justify-end gap-1"><CheckCircle size={12} /> Done</span>}
                                    {item.status === 'error' && <span className="text-xs text-red-500 flex items-center justify-end gap-1"><AlertCircle size={12} /> Error</span>}
                                 </div>
                             </div>
                         ))}
                         {batchItems.length === 0 && <div className="text-center text-slate-400 mt-20">{t.common.dragDrop}</div>}
                     </div>
                 </div>
             )}
          </div>
      </div>

      {/* --- RIGHT COLUMN: OUTPUT AREA --- */}
      <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.advancedRecolor.outputArea}</div>
          <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
              
              {/* SINGLE MODE RESULT */}
              {config.mode === 'single' && (
                  singleResult ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex-1 p-4 flex items-center justify-center bg-white dark:bg-slate-900/50 overflow-hidden">
                             {/* ENSURE FULL IMAGE DISPLAY WITHOUT CROP */}
                             <img 
                                src={singleResult} 
                                className="w-full h-full object-contain shadow-xl" 
                                style={{ maxHeight: 'calc(100vh - 350px)' }}
                                alt="Recolored Result"
                             />
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                             {/* Refine Section */}
                             <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  value={refinePrompt}
                                  onChange={(e) => setRefinePrompt(e.target.value)}
                                  placeholder="Hiệu chỉnh lại kết quả (VD: Giữ nguyên độ bóng, làm màu tươi hơn...)"
                                  className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                  onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button 
                                  onClick={handleRefine}
                                  disabled={loading || !refinePrompt}
                                  className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                                >
                                  <Send size={16} />
                                </button>
                             </div>

                             <a href={singleResult} download="recolored_result.png" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
                                 <Download size={20} /> {t.common.download}
                             </a>
                        </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                            <p>{t.common.noResult}</p>
                        </div>
                    </div>
                  )
              )}

              {/* BATCH MODE RESULT TABLE */}
              {config.mode === 'batch' && (
                   <div className="w-full h-full flex flex-col">
                       <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                           <h4 className="font-bold text-sm">Batch Results</h4>
                           <button onClick={handleDownloadAll} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold">
                               {t.advancedRecolor.btnDownloadAll}
                           </button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-0">
                           <table className="w-full text-left text-xs">
                               <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold sticky top-0">
                                   <tr>
                                       <th className="p-3">{t.advancedRecolor.batchTableFile}</th>
                                       <th className="p-3">{t.advancedRecolor.batchTableStatus}</th>
                                       <th className="p-3 text-right">{t.advancedRecolor.batchTableAction}</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                   {batchItems.map(item => (
                                       <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                           <td className="p-3 font-medium truncate max-w-[120px]">{item.file.name}</td>
                                           <td className="p-3">
                                               {item.status === 'done' ? <span className="text-green-500 font-bold">Done</span> : item.status}
                                           </td>
                                           <td className="p-3 text-right">
                                               {item.resultUrl && (
                                                   <a href={item.resultUrl} download={`recolored_${item.file.name}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                                       <Download size={14} /> Download
                                                   </a>
                                               )}
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

export default AdvancedRecolorTool;
