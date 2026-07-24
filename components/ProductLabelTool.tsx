
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, ProductLabelConfig, ProductLabelHistoryItem, BatchItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, CheckCircle, AlertCircle, Loader2, Upload, Move, Layers, MousePointer2, Maximize, Scan } from 'lucide-react';
import JSZip from 'jszip';

interface ProductLabelToolProps {
  t: any;
}

type InteractionMode = 'paint' | 'label';

const ProductLabelTool: React.FC<ProductLabelToolProps> = ({ t }) => {
  // --- STATE ---
  
  // Single Mode Images
  const [mainImage, setMainImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [labelImage, setLabelImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [assets, setAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  const [result, setResult] = useState<string | null>(null);
  
  // Interaction Mode
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('paint');

  // Label Transformation State
  const [labelTransform, setLabelTransform] = useState({
      x: 50, // % from left
      y: 50, // % from top
      scale: 1, // scale factor
      rotation: 0 // degrees
  });
  
  // Dragging State
  const isDraggingLabel = useRef(false);
  const isResizingLabel = useRef(false);
  const isRotatingLabel = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialTransform = useRef({...labelTransform});

  // Batch Mode
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // Masking
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null); // Reference to the container of image/canvas
  
  // Config
  const [config, setConfig] = useState<ProductLabelConfig>({
    mode: 'single',
    styleMode: 'original',
    style: 'photorealistic',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [history, setHistory] = useState<ProductLabelHistoryItem[]>([]);

  // --- HELPERS ---

  const handleMainImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setMainImage({
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

  const handleLabelImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setLabelImage({
          file,
          base64: e.target?.result as string,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        // Reset label transform
        setLabelTransform({ x: 50, y: 50, scale: 0.5, rotation: 0 });
        setInteractionMode('label'); // Auto switch to label mode
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
                  setAssets(prev => [...prev, {
                      id: Math.random().toString(),
                      file,
                      base64: ev.target?.result as string
                  }]);
              };
              reader.readAsDataURL(file);
          });
      }
  };

  // --- MASKING LOGIC (PAINT) ---

  // Helper to map mouse event to canvas coordinates accurately
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (interactionMode !== 'paint' || !canvasRef.current) return;
    
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Determine scale for brush size (since canvas resolution != display resolution)
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = canvasRef.current.width / rect.width;

    ctx.lineWidth = brushSize * scale;

    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red color for mask
    }
  };

  const draw = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    // Update cursor position for the custom cursor
    if (interactionMode === 'paint') {
        let clientX, clientY;
        if ('touches' in e) {
             clientX = e.touches[0].clientX;
             clientY = e.touches[0].clientY;
        } else {
             clientX = (e as React.MouseEvent).clientX;
             clientY = (e as React.MouseEvent).clientY;
        }
        // Use absolute client coordinates because the cursor div is position: fixed
        setCursorPos({ x: clientX, y: clientY });
    }

    if (!isDrawing || interactionMode !== 'paint' || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.closePath();
    }
  };

  const getMaskBase64 = (): string | null => {
      if (!canvasRef.current) return null;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const ctx = tempCanvas.getContext('2d');
      if(!ctx) return null;

      // Fill black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Get mask data (Red/Transparent)
      const srcCtx = canvasRef.current.getContext('2d');
      if (!srcCtx) return null;
      
      const srcData = srcCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = srcData.data;
      
      // Check if mask is empty
      let hasPixels = false;

      // Create Binary Mask (White = Selected, Black = Background)
      const destImageData = ctx.createImageData(tempCanvas.width, tempCanvas.height);
      const destData = destImageData.data;

      for (let i = 0; i < data.length; i += 4) {
          // If pixel has alpha > 0, it's part of the mask
          if (data[i+3] > 0) {
              destData[i] = 255;   // R
              destData[i+1] = 255; // G
              destData[i+2] = 255; // B
              destData[i+3] = 255; // A
              hasPixels = true;
          } else {
              destData[i] = 0;
              destData[i+1] = 0;
              destData[i+2] = 0;
              destData[i+3] = 255;
          }
      }

      if (!hasPixels) return null;

      ctx.putImageData(destImageData, 0, 0);
      return tempCanvas.toDataURL('image/png');
  };

  // --- LABEL MANIPULATION LOGIC ---

  const handleLabelMouseDown = (e: React.MouseEvent, action: 'move' | 'resize' | 'rotate') => {
      if (interactionMode !== 'label') return;
      e.stopPropagation();
      e.preventDefault();

      if (action === 'move') isDraggingLabel.current = true;
      if (action === 'resize') isResizingLabel.current = true;
      if (action === 'rotate') isRotatingLabel.current = true;

      dragStart.current = { x: e.clientX, y: e.clientY };
      initialTransform.current = { ...labelTransform };
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      
      const rect = workspaceRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;

      if (isDraggingLabel.current) {
          // Calculate percentage delta
          const percentDeltaX = (deltaX / rect.width) * 100;
          const percentDeltaY = (deltaY / rect.height) * 100;

          setLabelTransform(prev => ({
              ...prev,
              x: initialTransform.current.x + percentDeltaX,
              y: initialTransform.current.y + percentDeltaY
          }));
      }

      if (isResizingLabel.current) {
          // Scale sensitivity
          const scaleDelta = (deltaX + deltaY) / 200; 
          setLabelTransform(prev => ({
              ...prev,
              scale: Math.max(0.1, initialTransform.current.scale + scaleDelta)
          }));
      }

      if (isRotatingLabel.current) {
          // Simple rotation based on X movement
          const rotationDelta = deltaX * 0.5;
          setLabelTransform(prev => ({
              ...prev,
              rotation: initialTransform.current.rotation + rotationDelta
          }));
      }
  };

  const handleGlobalMouseUp = () => {
      isDraggingLabel.current = false;
      isResizingLabel.current = false;
      isRotatingLabel.current = false;
  };

  useEffect(() => {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, []);

  // --- COMPOSITE IMAGE GENERATION ---
  // Merges Main Image + Transformed Label into one base64 string
  const getCompositeImage = async (): Promise<string> => {
      if (!mainImage) return '';
      if (!labelImage) return mainImage.base64;

      const canvas = document.createElement('canvas');
      canvas.width = mainImage.width;
      canvas.height = mainImage.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // 1. Draw Main Image
      const mainImg = new Image();
      mainImg.src = mainImage.base64;
      await new Promise(r => mainImg.onload = r);
      ctx.drawImage(mainImg, 0, 0);

      // 2. Draw Label Image
      const labelImg = new Image();
      labelImg.src = labelImage.base64;
      await new Promise(r => labelImg.onload = r);

      const labelRenderWidth = mainImage.width * (labelTransform.scale * 0.5); // Corresponds to visual logic
      const aspectRatio = labelImg.width / labelImg.height;
      const labelRenderHeight = labelRenderWidth / aspectRatio;

      const centerX = (mainImage.width * labelTransform.x) / 100;
      const centerY = (mainImage.height * labelTransform.y) / 100;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((labelTransform.rotation * Math.PI) / 180);
      ctx.drawImage(labelImg, -labelRenderWidth / 2, -labelRenderHeight / 2, labelRenderWidth, labelRenderHeight);
      ctx.restore();

      return canvas.toDataURL('image/png');
  };


  // --- PROCESSING ---

  const handleProcessSingle = async () => {
    if (!mainImage) return;
    setLoading(true); setError(null);
    try {
        // 1. Create Composite (Main + Label placed)
        const compositeBase64 = await getCompositeImage();
        
        // 2. Get Mask
        const maskBase64 = getMaskBase64();
        
        // Use customPrompt combined with refinePrompt if any
        const fullPrompt = config.customPrompt + (refinePrompt ? `\nRefinement: ${refinePrompt}` : '');

        // Gather all references: Label Image + Extra Assets
        const allRefs = [];
        if (labelImage) allRefs.push(labelImage.base64); 
        if (assets.length > 0) allRefs.push(...assets.map(a => a.base64));

        const output = await processImage(
            ToolType.PRODUCT_LABEL,
            compositeBase64, // Send composite as the "Image"
            'image/png', // FIXED: Composite image from canvas is always PNG
            fullPrompt,
            { ...config, mask: maskBase64 || undefined },
            allRefs
        );

        setResult(output);
        setRefinePrompt('');
        
        // History
        const historyItem: ProductLabelHistoryItem = {
            id: Date.now().toString(),
            originalImage: mainImage.base64,
            labelImage: labelImage?.base64,
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
      if (batchItems.length === 0) {
          setError("Vui lòng tải lên ít nhất một nhãn dán trong danh sách hàng loạt.");
          return;
      }
      if (!mainImage) {
          setError("Vui lòng tải lên ảnh sản phẩm mẫu.");
          return;
      }
      
      setLoading(true); setError(null);
      
      const newItems = [...batchItems];
      const maskBase64 = getMaskBase64();
      
      for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].status === 'done') continue;
          
          newItems[i].status = 'processing';
          setBatchItems([...newItems]);
          setProcessingStatus(`${t.common.processing} ${i + 1}/${newItems.length}`);
          
          try {
             const labelBase64 = await new Promise<string>((resolve) => {
                 const reader = new FileReader();
                 reader.onload = () => resolve(reader.result as string);
                 reader.readAsDataURL(newItems[i].file);
             });

             const allRefs = [labelBase64, ...assets.map(a => a.base64)];

             // For batch, rely on the mask and the reference label.
             const output = await processImage(
                 ToolType.PRODUCT_LABEL,
                 mainImage.base64,
                 mainImage.file.type, // Use original mime type for batch main image
                 config.customPrompt,
                 { ...config, mask: maskBase64 || undefined },
                 allRefs
             );

             newItems[i].resultUrl = output;
             newItems[i].status = 'done';
          } catch (e) {
             console.error(e);
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
      setProcessingStatus(t.productLabel.zipGenerating);

      try {
          const zip = new JSZip();
          for (let i = 0; i < completedItems.length; i++) {
              const item = completedItems[i];
              if (!item.resultUrl) continue;
              const base64Data = item.resultUrl.split(',')[1];
              const fileName = `mockup_${item.file.name.split('.')[0]}.png`;
              zip.file(fileName, base64Data, {base64: true});
          }
          const blob = await zip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = "product_mockup_batch.zip";
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

  // --- RESTORE ---
  const handleRestore = (item: ProductLabelHistoryItem) => {
      setMainImage({ file: new File([], "restored"), base64: item.originalImage, width: 0, height: 0 }); // Size will recalc on load or needs explicit save
      if (item.labelImage) {
          setLabelImage({ file: new File([], "label"), base64: item.labelImage, width: 0, height: 0 });
      } else {
          setLabelImage(null);
      }
      setResult(item.resultImage);
      setConfig(item.config);
  };

  const handleReset = () => {
      setMainImage(null);
      setLabelImage(null);
      setResult(null);
      setAssets([]);
      setBatchItems([]);
      setConfig({
        mode: 'single',
        styleMode: 'original',
        style: 'photorealistic',
        quality: 'keep_original',
        upscale: 'x1',
        customPrompt: ''
      });
      setLabelTransform({ x: 50, y: 50, scale: 1, rotation: 0 });
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
       {loading && <LoadingOverlay message={processingStatus || t.productLabel.loading} t={t} />}

       {/* --- LEFT: CONTROL PANEL --- */}
       <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.productLabel.panelTitle}
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

            {/* Style */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.productLabel.styleLabel}</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                    <button 
                        onClick={() => setConfig({...config, styleMode: 'original'})}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.styleMode === 'original' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        Original
                    </button>
                    <button 
                        onClick={() => setConfig({...config, styleMode: 'new'})}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.styleMode === 'new' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        New Style
                    </button>
                </div>
                {config.styleMode === 'new' && (
                    <select 
                        value={config.style}
                        onChange={(e) => setConfig({...config, style: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                    >
                        {Object.entries(t.productLabel.styles)
                            .sort((a,b) => (a[1] as string).localeCompare(b[1] as string))
                            .map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Masking Tool */}
            {mainImage && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        {t.productLabel.maskTitle} <span className="text-red-500 text-[10px]">(Bắt buộc)</span>
                    </label>
                    <div className="flex gap-2">
                        <button onClick={() => { setIsEraser(false); setInteractionMode('paint'); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser && interactionMode === 'paint' ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.productLabel.brush}
                        </button>
                        <button onClick={() => { setIsEraser(true); setInteractionMode('paint'); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser && interactionMode === 'paint' ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.productLabel.eraser}
                        </button>
                    </div>
                    {interactionMode === 'paint' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <span className="text-[10px] w-12">{t.productLabel.brushSize}</span>
                            <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                        </div>
                    )}
                    <p className="text-[10px] text-slate-400 italic">Dùng cọ tô kín vùng bạn muốn dán nhãn lên sản phẩm.</p>
                </div>
            )}

            {/* Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">{t.productLabel.qualityLabel}</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">{t.productLabel.qualityKeep}</option>
                         <option value="enhance">{t.productLabel.qualityEnhance}</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">{t.productLabel.upscaleLabel}</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.productLabel.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.productLabel.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={config.mode === 'single' ? handleProcessSingle : handleProcessBatch}
                    disabled={loading || (config.mode === 'single' ? !mainImage : batchItems.length === 0)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-base"
                >
                    {t.productLabel.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.productLabel.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.productLabel.btnExit}
                     </button>
                </div>
            </div>

            {/* History */}
            {config.mode === 'single' && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.productLabel.historyTitle}</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {history.map(item => (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                                <img src={item.resultImage} className="w-10 h-10 object-cover rounded" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate">Mockup</div>
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
            )}
       </div>

       {/* --- CENTER: INPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.productLabel.inputArea}</div>
          <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
              
              {/* Tool Mode Switcher (Visible only when Main Image is loaded) */}
              {mainImage && (
                  <div className="flex justify-center mb-4">
                      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <button
                              onClick={() => setInteractionMode('paint')}
                              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${interactionMode === 'paint' ? 'bg-white dark:bg-slate-700 shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <Brush size={14} /> Vẽ Vùng Dán (Mask)
                          </button>
                          <button
                              onClick={() => setInteractionMode('label')}
                              disabled={!labelImage}
                              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${interactionMode === 'label' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'} ${!labelImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                              <MousePointer2 size={14} /> Chỉnh Nhãn (Label)
                          </button>
                      </div>
                  </div>
              )}

              {/* Interactive Area */}
              <div className="flex flex-col gap-4">
                  {mainImage ? (
                      <div 
                        ref={workspaceRef}
                        className="relative flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group min-h-[400px]"
                        // Touch events for mobile painting
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      >
                          {/* Layer 1: Product Image */}
                          <div className="relative max-w-full max-h-full">
                              <img 
                                src={mainImage.base64} 
                                className="block max-w-full max-h-[calc(100vh-350px)] object-contain select-none pointer-events-none" 
                                draggable={false}
                              />

                              {/* Layer 2: Label Image (Transformable) - Z-Index depends on mode */}
                              {labelImage && (
                                <div 
                                    className={`absolute top-0 left-0 origin-center ${interactionMode === 'label' ? 'z-30 cursor-move' : 'z-10 pointer-events-none opacity-80'}`}
                                    style={{
                                        left: `${labelTransform.x}%`,
                                        top: `${labelTransform.y}%`,
                                        width: `${labelTransform.scale * 50}%`, // Simplified scale mapping
                                        transform: `translate(-50%, -50%) rotate(${labelTransform.rotation}deg)`,
                                    }}
                                    onMouseDown={(e) => handleLabelMouseDown(e, 'move')}
                                >
                                    <img 
                                        src={labelImage.base64} 
                                        className="w-full h-auto object-contain select-none" 
                                        draggable={false}
                                    />
                                    
                                    {/* Controls (Only visible in label mode) */}
                                    {interactionMode === 'label' && (
                                        <>
                                            <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none"></div>
                                            {/* Rotate Handle */}
                                            <div 
                                                className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow border border-blue-500 flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto"
                                                onMouseDown={(e) => handleLabelMouseDown(e, 'rotate')}
                                            >
                                                <RotateCcw size={12} className="text-blue-600" />
                                            </div>
                                            {/* Resize Handle */}
                                            <div 
                                                className="absolute -bottom-3 -right-3 w-6 h-6 bg-white rounded-full shadow border border-blue-500 flex items-center justify-center cursor-nwse-resize pointer-events-auto"
                                                onMouseDown={(e) => handleLabelMouseDown(e, 'resize')}
                                            >
                                                <Maximize size={12} className="text-blue-600" />
                                            </div>
                                        </>
                                    )}
                                </div>
                              )}

                              {/* Layer 3: Masking Canvas - Z-Index depends on mode */}
                              <canvas 
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={() => { stopDrawing(); setCursorPos(null); }}
                                // Important: Pointer events logic
                                className={`absolute inset-0 w-full h-full touch-none ${interactionMode === 'paint' ? 'z-30 cursor-none' : 'z-10 pointer-events-none opacity-50'}`}
                              />

                              {/* Circular Brush Cursor (Only in Paint Mode) */}
                              {interactionMode === 'paint' && cursorPos && (
                                <div 
                                    className="fixed rounded-full border border-red-500 bg-red-500/20 pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: cursorPos.x,
                                        top: cursorPos.y,
                                        width: brushSize,
                                        height: brushSize
                                    }}
                                />
                              )}
                          </div>

                          <div className="absolute top-2 right-2 flex gap-2 z-40">
                              <button onClick={() => { setMainImage(null); setLabelImage(null); setInteractionMode('paint'); }} className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow">
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex-1 p-6 flex flex-col justify-center">
                          <ImageUploader onImageSelect={(file, base64) => handleMainImageUpload(file)} previewUrl={null} t={t} />
                      </div>
                  )}

                  {/* Template Label Controls */}
                  {mainImage && (
                      <div className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="w-20 h-20 flex-shrink-0">
                              {labelImage ? (
                                  <div className="relative w-full h-full rounded border border-slate-300 dark:border-slate-600 overflow-hidden group">
                                      <img src={labelImage.base64} className="w-full h-full object-cover" />
                                      <button onClick={() => setLabelImage(null)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Trash2 size={16}/></button>
                                  </div>
                              ) : (
                                  <label className="w-full h-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs text-center text-slate-500">
                                      <Upload size={16} className="mb-1"/> Ảnh Nhãn
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleLabelImageUpload(e.target.files[0]) }} />
                                  </label>
                              )}
                          </div>
                          
                          {/* Instructions */}
                          <div className="flex-1 text-xs text-slate-500">
                              <p className="font-bold mb-1">Hướng dẫn:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                  <li>Tải ảnh nhãn dán lên để AI tham khảo mẫu.</li>
                                  <li>Chọn chế độ <strong>"Vẽ Vùng Dán"</strong> để tô đỏ khu vực trên sản phẩm.</li>
                                  <li>Chọn chế độ <strong>"Chỉnh Nhãn"</strong> để ướm thử vị trí (kéo, xoay, chỉnh to nhỏ).</li>
                              </ul>
                          </div>
                      </div>
                  )}

                  {/* Batch Upload Section (Only visible in Batch Mode) */}
                  {config.mode === 'batch' && mainImage && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">{t.advancedRecolor.batchUpload} (List)</label>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                              <label className="flex-shrink-0 w-20 h-20 border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500">
                                  <Layers size={20} className="mb-1" />
                                  <span className="text-[10px] font-bold">+ Labels</span>
                                  <input type="file" multiple className="hidden" accept="image/*" onChange={handleBatchUpload} />
                              </label>
                              {batchItems.map((item, idx) => (
                                  <div key={item.id} className="flex-shrink-0 w-20 h-20 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden relative group">
                                      <img src={item.previewUrl} className="w-full h-full object-cover" />
                                      {item.status === 'done' && <div className="absolute top-1 right-1 text-green-500 bg-white rounded-full"><CheckCircle size={14}/></div>}
                                      {item.status === 'processing' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={16} className="text-white animate-spin"/></div>}
                                      <button onClick={() => handleDeleteBatchItem(item.id)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"><Trash2 size={16}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Extra Assets (Only Single Mode) */}
                  {config.mode === 'single' && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                          <label className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                              <Plus size={20} className="text-slate-400" />
                              <input type="file" multiple className="hidden" accept="image/*" onChange={handleAssetUpload} />
                          </label>
                          {assets.map(asset => (
                              <div key={asset.id} className="flex-shrink-0 w-16 h-16 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden relative group">
                                  <img src={asset.base64} className="w-full h-full object-cover" />
                                  <button onClick={() => setAssets(prev => prev.filter(a => a.id !== asset.id))} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"><Trash2 size={14}/></button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
       </div>

       {/* --- RIGHT: OUTPUT --- */}
       <div className="flex-1 flex flex-col gap-3 min-w-[300px]">
          <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.productLabel.outputArea}</div>
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
                                    placeholder={t.productLabel.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleProcessSingle()}
                                 />
                                 <button onClick={handleProcessSingle} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                     <Send size={16} />
                                 </button>
                             </div>
                             <a href={result} download={`product_mockup.png`} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
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
                                       <th className="p-3 w-32">{t.portraitEditing.batchTableFile}</th>
                                       <th className="p-3 text-center">{t.portraitEditing.batchTableResult}</th>
                                       <th className="p-3">{t.portraitEditing.batchTableStatus}</th>
                                       <th className="p-3 text-right">{t.portraitEditing.batchTableAction}</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                   {batchItems.map(item => (
                                       <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                           <td className="p-3 font-medium truncate max-w-[100px]" title={item.file.name}>{item.file.name}</td>
                                           <td className="p-3 text-center">
                                               {item.resultUrl ? (
                                                   <img src={item.resultUrl} className="w-16 h-16 object-cover rounded border border-green-500 mx-auto" alt="After" />
                                               ) : (
                                                   <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center text-slate-400 mx-auto text-[10px]">-</div>
                                               )}
                                           </td>
                                           <td className="p-3">
                                               {item.status === 'done' ? <span className="text-green-600 font-bold bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">Done</span> : 
                                                item.status === 'processing' ? <span className="text-blue-500 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Processing</span> :
                                                item.status === 'error' ? <span className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12}/> Error</span> :
                                                <span className="text-slate-400 text-xs">Pending</span>
                                               }
                                           </td>
                                           <td className="p-3 text-right">
                                               <div className="flex justify-end gap-2">
                                                   {item.resultUrl && (
                                                       <a href={item.resultUrl} download={`mockup_${item.file.name}`} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 rounded-lg" title="Download">
                                                           <Download size={14} />
                                                       </a>
                                                   )}
                                                   <button onClick={() => handleDeleteBatchItem(item.id)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 rounded-lg" title="Delete">
                                                       <Trash2 size={14} />
                                                   </button>
                                               </div>
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                           {batchItems.length === 0 && <div className="p-10 text-center text-slate-400">{t.common.noResult}</div>}
                       </div>
                   </div>
             )}
          </div>
       </div>

       {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default ProductLabelTool;
