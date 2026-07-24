
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, InvitationDesignConfig, InvitationHistoryItem } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, Upload, Mail } from 'lucide-react';

interface InvitationDesignToolProps {
  t: any;
}

const InvitationDesignTool: React.FC<InvitationDesignToolProps> = ({ t }) => {
  // --- STATE ---
  const [image, setImage] = useState<{file: File, base64: string} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  const [result, setResult] = useState<string | null>(null);
  
  // Config
  const [config, setConfig] = useState<InvitationDesignConfig>({
    designMode: 'custom',
    cardType: 'wedding',
    content: '',
    fontStyle: 'script',
    fontSize: 'medium',
    textColor: '#000000',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // History
  const [history, setHistory] = useState<InvitationHistoryItem[]>([]);

  // Masking
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
          base64: e.target?.result as string
        });
        setResult(null);
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

  // Masking Logic
  useEffect(() => {
    if (image && canvasRef.current) {
        const img = new Image();
        img.src = image.base64;
        img.onload = () => {
            if(canvasRef.current) {
                canvasRef.current.width = img.naturalWidth;
                canvasRef.current.height = img.naturalHeight;
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
            }
        }
    }
  }, [image]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, scale: 1 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY, scale: scaleX };
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
      // Validation: If mode is 'sample', image is required.
      if (config.designMode === 'sample' && !image) {
          setError("Vui lòng tải lên ảnh mẫu khi chọn chế độ 'Theo mẫu đính kèm'.");
          return;
      }

      setLoading(true);
      setError(null);
      setLoadingMessage(t.invitationDesign.waitMessage);

      try {
          const mask = image ? getMaskBase64() : null;
          
          const output = await processImage(
              ToolType.INVITATION_DESIGN,
              image ? image.base64 : null, // Can be null if custom mode
              image ? image.file.type : null,
              config.customPrompt,
              { ...config, mask: mask || undefined },
              additionalAssets.map(a => a.base64)
          );

          setResult(output);

          // Save History
          const historyItem: InvitationHistoryItem = {
              id: Date.now().toString(),
              originalImage: image?.base64,
              additionalAssets: additionalAssets.map(a => a.base64),
              resultImage: output,
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
      if (!refinePrompt) return;
      const updatedPrompt = `${config.customPrompt} \n\n Refinement: ${refinePrompt}`;
      setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));
      handleProcess();
      setRefinePrompt('');
  };

  const handleReset = () => {
      setImage(null);
      setAdditionalAssets([]);
      setResult(null);
      setConfig({ 
          designMode: 'custom',
          cardType: 'wedding',
          content: '',
          fontStyle: 'script',
          fontSize: 'medium',
          textColor: '#000000',
          quality: 'keep_original',
          upscale: 'x1',
          customPrompt: '' 
      });
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleRestore = (item: InvitationHistoryItem) => {
      if (item.originalImage) {
          setImage({ file: new File([], "restored"), base64: item.originalImage });
      } else {
          setImage(null);
      }
      setAdditionalAssets(item.additionalAssets.map(b64 => ({ id: Math.random().toString(), file: new File([], "asset"), base64: b64 })));
      setResult(item.resultImage);
      setConfig(item.config);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
        {loading && <LoadingOverlay message={loadingMessage || t.invitationDesign.loading} t={t} />}

        {/* --- LEFT: CONTROL PANEL --- */}
        <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.invitationDesign.panelTitle}
            </h3>

            {/* 1. Design Mode & Type */}
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.designModeLabel}</label>
                    <select 
                        value={config.designMode} 
                        onChange={(e) => setConfig({...config, designMode: e.target.value as any})}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                    >
                        <option value="sample">{t.invitationDesign.modeSample}</option>
                        <option value="custom">{t.invitationDesign.modeCustom}</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.cardTypeLabel}</label>
                    <select 
                        value={config.cardType} 
                        onChange={(e) => setConfig({...config, cardType: e.target.value as any})}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                    >
                        {Object.entries(t.invitationDesign.types).map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 2. Content */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.contentLabel}</label>
                <textarea 
                    value={config.content}
                    onChange={(e) => setConfig({...config, content: e.target.value})}
                    placeholder={t.invitationDesign.contentPlaceholder}
                    className="w-full p-2.5 h-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm resize-none"
                />
            </div>

            {/* 3. Typography */}
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.fontLabel}</label>
                    <select 
                        value={config.fontStyle} 
                        onChange={(e) => setConfig({...config, fontStyle: e.target.value})}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    >
                        {Object.entries(t.invitationDesign.fonts).map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.fontSizeLabel}</label>
                    <select 
                        value={config.fontSize} 
                        onChange={(e) => setConfig({...config, fontSize: e.target.value as any})}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    >
                        {Object.entries(t.invitationDesign.fontSizes).map(([key, label]) => (
                            <option key={key} value={key}>{label as string}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 4. Color */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.colorLabel}</label>
                <div className="flex gap-2">
                    <input 
                        type="color" 
                        value={config.textColor} 
                        onChange={(e) => setConfig({...config, textColor: e.target.value})} 
                        className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                    />
                    <input 
                        type="text" 
                        value={config.textColor} 
                        onChange={(e) => setConfig({...config, textColor: e.target.value})} 
                        className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 uppercase font-mono"
                    />
                </div>
            </div>

            {/* 5. Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.invitationDesign.qualityLabel}</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">{t.invitationDesign.qualityKeep}</option>
                         <option value="enhance">{t.invitationDesign.qualityEnhance}</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.invitationDesign.upscaleLabel}</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* 6. Masking Tool (Only visible if image loaded) */}
            {image && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.invitationDesign.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.invitationDesign.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.invitationDesign.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>
                </div>
            )}

            {/* 7. Custom Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.invitationDesign.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.invitationDesign.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* 8. Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-base"
                >
                    {t.invitationDesign.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.invitationDesign.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.invitationDesign.btnExit}
                     </button>
                </div>
            </div>

            {/* 9. History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.invitationDesign.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.resultImage} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{t.invitationDesign.types[item.config.cardType]}</div>
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
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.invitationDesign.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                
                {config.designMode === 'sample' ? (
                    // Sample Mode: Show Uploader
                    <div className="flex-1 flex flex-col min-h-[300px] mb-4">
                        <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{t.invitationDesign.uploadRef}</label>
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
                ) : (
                    // Custom Mode: Placeholder Graphic
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
                        <Mail size={64} className="text-slate-400 mb-4" />
                        <p className="text-sm font-medium">Chế độ thiết kế mới không cần ảnh mẫu.</p>
                        <p className="text-xs">AI sẽ tạo thiệp dựa trên cài đặt và mô tả của bạn.</p>
                    </div>
                )}

                {/* Additional Assets */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Plus size={16} /> {t.invitationDesign.uploadAssets}
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
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.invitationDesign.outputArea}</div>
            <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                {result ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex-1 p-4 flex items-center justify-center bg-white dark:bg-slate-900/50 overflow-hidden relative">
                            {/* Use w-full h-full to fill the flex container, object-contain preserves aspect ratio */}
                            <img src={result} className="w-full h-full object-contain shadow-2xl" />
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 border-t space-y-3">
                            {/* Refine */}
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    placeholder={t.invitationDesign.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    <Send size={16} />
                                </button>
                            </div>
                            <a href={result} download="invitation_design.png" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                <Download size={18} /> {t.invitationDesign.download}
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <p>{t.invitationDesign.emptyOutput}</p>
                    </div>
                )}
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default InvitationDesignTool;
