import React, { useState, useRef, useEffect } from 'react';
import { ToolType } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { Eraser, PlusCircle, Undo, Download, Trash2, ArrowRight, RefreshCcw, Upload, Brush } from 'lucide-react';

interface ObjectEditingToolProps {
  t: any;
}

const ObjectEditingTool: React.FC<ObjectEditingToolProps> = ({ t }) => {
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [refImage, setRefImage] = useState<{file: File, base64: string} | null>(null);
  
  const [mode, setMode] = useState<'remove' | 'add' | 'replace'>('remove');
  
  // Brush State: false = Paint, true = Eraser
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  
  const [prompt, setPrompt] = useState('');
  
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [history, setHistory] = useState<ImageData[]>([]);

  // Load image and get natural dimensions
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
        setHistory([]); // Reset history on new image
        setResult(null); // Reset result
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Initialize Canvas Size when image changes
  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas resolution to match original image resolution strictly
      canvas.width = image.width;
      canvas.height = image.height;
      
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [image]);

  // When mode changes, reset ref image if needed, or keep it if switching between add/replace
  const handleModeChange = (newMode: 'remove' | 'add' | 'replace') => {
      setMode(newMode);
      setPrompt('');
  };

  // Helper to map screen coordinates to canvas (image) coordinates
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factor (Bitmap Resolution / CSS Display Size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scale: scaleX // Assuming uniform scaling for brush size, or use average of X/Y
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
    
    // Configure Brush Logic
    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'; // Eraser mode (transparency)
    } else {
        ctx.globalCompositeOperation = 'source-over'; // Paint mode (red)
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)'; 
    }
    
    // Scale brush size to match image resolution
    ctx.lineWidth = brushSize * coords.scale; 
    
    // Save state for undo
    setHistory([...history, ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // For drawing on canvas
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCursorPos({ 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
    });

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
       // Reset composite operation to default just in case
       ctx.globalCompositeOperation = 'source-over';
    }
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (!canvasRef.current || history.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const lastState = history[history.length - 1];
      // When restoring imageData, globalCompositeOperation doesn't matter, it overwrites pixels
      ctx.putImageData(lastState, 0, 0);
      setHistory(history.slice(0, -1));
    }
  };

  const clearCanvas = () => {
     if (!canvasRef.current) return;
     const ctx = canvasRef.current.getContext('2d');
     ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
     setHistory([]);
  };

  const getMaskAsBase64 = (): string | null => {
      if (!canvasRef.current) return null;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return null;

      // 1. Fill black background (The area NOT to change)
      tCtx.fillStyle = 'black';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // 2. Scan the main canvas data
      // We convert red strokes to pure white (The area TO change)
      const mainCtx = canvasRef.current.getContext('2d');
      if (!mainCtx) return null;
      
      const mainImageData = mainCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const data = mainImageData.data;
      
      const targetImageData = tCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const targetData = targetImageData.data;

      // Loop through pixels
      for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const a = data[i+3];

          // Threshold check: If it has significant redness or opacity, treat it as mask
          if (a > 10 && r > 20) { 
             targetData[i] = 255;     // R -> White
             targetData[i+1] = 255;   // G -> White
             targetData[i+2] = 255;   // B -> White
             targetData[i+3] = 255;   // Alpha -> Opaque
          } else {
             targetData[i] = 0;       // Black
             targetData[i+1] = 0;
             targetData[i+2] = 0;
             targetData[i+3] = 255;   // Opaque
          }
      }
      
      tCtx.putImageData(targetImageData, 0, 0);
      return tempCanvas.toDataURL('image/png');
  };

  const handleProcess = async () => {
    if (!image) return;
    const mask = getMaskAsBase64();
    if (!mask) return;

    setLoading(true);
    setError(null);
    try {
      const output = await processImage(
        ToolType.OBJECT_EDITING,
        image.base64,
        image.file.type,
        prompt,
        { mode, mask }, 
        refImage?.base64
      );
      setResult(output);
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
      if (mode === 'remove') return t.objectEditing.promptPlaceholderRemove;
      if (mode === 'replace') return t.objectEditing.promptPlaceholderReplace;
      return t.objectEditing.promptPlaceholderAdd;
  }

  return (
    <div className="flex flex-col h-full min-h-[600px] text-slate-800 dark:text-slate-100">
      {loading && <LoadingOverlay message={t.objectEditing.loading} t={t} />}
      
      {/* Hidden File Input for Image Swap */}
      <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if(file) handleImageUpload(file);
            // Reset to allow selecting same file
            e.target.value = '';
          }} 
          className="hidden" 
          accept="image/*" 
      />

      <div className="flex flex-col xl:flex-row gap-6 h-full">
        
        {/* --- LEFT SIDEBAR: TOOLS --- */}
        <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col gap-6 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            
            <h3 className="font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                {t.app.tools.objectEditing}
            </h3>

            {/* Mode Selection */}
            <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">{t.header.tools}</label>
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={() => handleModeChange('remove')}
                        className={`w-full flex items-center p-3 rounded-xl border transition-all ${
                            mode === 'remove' 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                    >
                        <div className={`p-2 rounded-lg mr-3 ${mode === 'remove' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                            <Eraser size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">{t.objectEditing.modeRemove}</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleModeChange('add')}
                        className={`w-full flex items-center p-3 rounded-xl border transition-all ${
                            mode === 'add' 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                    >
                        <div className={`p-2 rounded-lg mr-3 ${mode === 'add' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                            <PlusCircle size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">{t.objectEditing.modeAdd}</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleModeChange('replace')}
                        className={`w-full flex items-center p-3 rounded-xl border transition-all ${
                            mode === 'replace' 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                    >
                        <div className={`p-2 rounded-lg mr-3 ${mode === 'replace' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                            <RefreshCcw size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">{t.objectEditing.modeReplace}</div>
                        </div>
                    </button>
                </div>
            </div>

             {/* Brush Size & Type */}
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">{t.objectEditing.brushMode}</label>
                </div>
                
                {/* Paint / Erase Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setIsEraser(false)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
                             !isEraser 
                             ? 'bg-white dark:bg-slate-700 text-red-500 shadow-sm border border-slate-200 dark:border-slate-600' 
                             : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        <Brush size={16} /> {t.objectEditing.brushPaint}
                    </button>
                    <button
                        onClick={() => setIsEraser(true)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
                             isEraser 
                             ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600' 
                             : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        <Eraser size={16} /> {t.objectEditing.brushErase}
                    </button>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">{t.objectEditing.brushSize}</label>
                        <span className="text-xs font-mono">{brushSize}px</span>
                    </div>
                    <input
                        type="range" min="5" max="100"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
            </div>

            {/* Upload Object (For Add and Replace Mode) */}
            {(mode === 'add' || mode === 'replace') && (
                <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                     <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                         {mode === 'add' ? t.objectEditing.uploadObjLabel : t.objectEditing.uploadReplaceObjLabel}
                     </label>
                     <div className="flex items-center gap-3">
                         <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden flex items-center justify-center">
                            {refImage ? <img src={refImage.base64} className="w-full h-full object-cover" /> : <PlusCircle className="text-slate-400" />}
                         </div>
                         <label className="flex-1 cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 py-2 px-3 rounded-lg text-sm text-center transition-colors">
                            {t.objectEditing.uploadPlaceholder}
                            <input type="file" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if(file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setRefImage({file, base64: reader.result as string});
                                    reader.readAsDataURL(file);
                                }
                            }} className="hidden" accept="image/*" />
                         </label>
                     </div>
                </div>
            )}

            {/* Prompt Input */}
            <div className="space-y-2">
                 <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">{t.objectEditing.promptLabel}</label>
                 <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={getPlaceholder()}
                    className="w-full p-3 h-24 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 resize-none"
                 />
            </div>

            <Button 
                onClick={handleProcess}
                disabled={!image || loading || ((mode === 'add' || mode === 'replace') && !refImage)}
                className="w-full mt-auto py-3 text-base shadow-lg shadow-blue-500/20"
            >
                {t.objectEditing.btnProcess} <ArrowRight size={18} className="ml-2" />
            </Button>
        </div>

        {/* --- CENTER & RIGHT: WORKSPACE --- */}
        <div className="flex-1 flex gap-6 overflow-hidden">
            
            {/* Editor Area (Canvas) */}
            <div className="flex-1 flex flex-col gap-2 relative">
                 <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold uppercase text-slate-500">{t.objectEditing.labelOriginal}</span>
                    <div className="flex gap-2">
                         <button onClick={handleUndo} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300" title="Undo">
                            <Undo size={18} />
                         </button>
                         <button onClick={clearCanvas} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500" title={t.objectEditing.clearMask}>
                            <Trash2 size={18} />
                         </button>
                         
                         {/* CHANGE IMAGE BUTTON */}
                         {image && (
                             <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400" 
                                title={t.common.changeImage}
                             >
                                <Upload size={18} />
                             </button>
                         )}

                         {!image && (
                            <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                <PlusCircle size={14} /> {t.common.uploadTitle}
                                <input type="file" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) handleImageUpload(file);
                                }} className="hidden" accept="image/*" />
                            </label>
                         )}
                    </div>
                 </div>

                 {/* Canvas Container */}
                 <div 
                    ref={containerRef}
                    className={`relative flex-1 bg-slate-900/50 rounded-xl overflow-hidden border-2 border-dashed border-slate-700 flex items-center justify-center cursor-none group select-none ${isEraser ? 'cursor-cell' : ''}`}
                    onMouseEnter={() => {}} 
                 >
                    {image ? (
                        <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl">
                             {/* The Wrapper ensures Canvas overlays the image strictly */}
                            <img 
                                src={image.base64} 
                                className="max-w-full max-h-full block object-contain select-none" 
                                style={{ maxHeight: 'calc(100vh - 300px)' }} // Prevent overflow
                                alt="Original"
                                draggable={false}
                            />
                            {/* Canvas matches the dimensions of the rendered image via "absolute inset-0" within the wrapper */}
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={() => {
                                    stopDrawing();
                                    setCursorPos({ x: -100, y: -100 });
                                }}
                                className="absolute inset-0 w-full h-full cursor-none z-10 touch-none opacity-60" 
                                // Opacity only affects display, not mask generation
                            />
                            
                            {/* Custom Brush Cursor */}
                            <div 
                                className={`fixed rounded-full border-2 z-50 pointer-events-none mix-blend-normal ${isEraser ? 'border-white bg-white/20' : 'border-white bg-red-500/40'}`}
                                style={{
                                    width: brushSize, 
                                    height: brushSize,
                                    left: 0,
                                    top: 0,
                                    transform: `translate(${cursorPos.x + (canvasRef.current?.getBoundingClientRect().left || 0) - brushSize/2}px, ${cursorPos.y + (canvasRef.current?.getBoundingClientRect().top || 0) - brushSize/2}px)`,
                                    opacity: cursorPos.x > -50 ? 1 : 0
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-center p-10 cursor-default">
                             <p className="text-slate-500">{t.common.dragDrop}</p>
                        </div>
                    )}
                 </div>
            </div>

            {/* Result Area */}
            <div className="flex-1 flex flex-col gap-2">
                 <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold uppercase text-slate-500">{t.objectEditing.labelResult}</span>
                    {result && (
                        <a href={result} download="edited_image.png" className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2">
                             <Download size={14} /> {t.common.download}
                        </a>
                    )}
                 </div>

                 <div className="relative flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {result ? (
                        <img src={result} className="max-w-full max-h-full object-contain" alt="Result" />
                    ) : (
                        <div className="text-slate-500 text-sm">{t.objectEditing.emptyState}</div>
                    )}
                 </div>
            </div>

        </div>

      </div>
      
      {error && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800 text-center">{error}</div>}
    </div>
  );
};

export default ObjectEditingTool;