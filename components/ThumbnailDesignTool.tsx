
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, ThumbnailDesignConfig, ThumbnailHistoryItem } from '../types';
import { processImage, analyzeImageStyle } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, Upload, Palette, X, Sparkles, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';

interface ThumbnailDesignToolProps {
  t: any;
  lang: 'vi' | 'en';
}

// Mapping from internal ID to CSS Font Family (approximated with Google Fonts where exact match isn't available)
const FONT_MAPPING: Record<string, string> = {
  impact: 'Impact, "Arial Narrow Bold", sans-serif', // System font usually
  bebas_neue: "'Bebas Neue', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  roboto_condensed: "'Roboto Condensed', sans-serif",
  oswald: "'Oswald', sans-serif",
  lato: "'Lato', sans-serif",
  open_sans: "'Open Sans', sans-serif",
  permanent_marker: "'Permanent Marker', cursive",
  caveat: "'Caveat', cursive",
  pacifico: "'Pacifico', cursive",
  road_rage: "'Road Rage', cursive", 
  obelix_pro: "'Luckiest Guy', cursive", // Google Font alternative for Obelix Pro
  playfair_display: "'Playfair Display', serif",
  merriweather: "'Merriweather', serif",
  orbitron: "'Orbitron', sans-serif",
  russo_one: "'Russo One', sans-serif",
  bangers: "'Bangers', system-ui",
  komika_axis: "'Carter One', system-ui", // Google Font alternative for Komika
  chiller: "'Creepster', system-ui", // Google Font alternative for Chiller
  double_feature: "'Nosifer', system-ui", // Google Font alternative for Double Feature
};

const ThumbnailDesignTool: React.FC<ThumbnailDesignToolProps> = ({ t, lang }) => {
  // --- STATE ---
  const [image, setImage] = useState<{file: File, base64: string, width: number, height: number} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  
  // Config
  const [config, setConfig] = useState<ThumbnailDesignConfig>({
    style: 'action',
    textContent: '',
    font: 'impact',
    typography: 'bold_outline',
    textColor: '#FFDD00',
    aspectRatio: '16:9',
    quality: 'keep_original',
    upscale: 'x1',
    customPrompt: ''
  });

  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // History
  const [history, setHistory] = useState<ThumbnailHistoryItem[]>([]);

  // Masking
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- EFFECTS ---
  
  // Load Google Fonts
  useEffect(() => {
    const linkId = 'thumbnail-google-fonts';
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.href = "https://fonts.googleapis.com/css2?family=Bangers&family=Bebas+Neue&family=Carter+One&family=Caveat&family=Creepster&family=Lato:wght@400;700&family=Luckiest+Guy&family=Merriweather:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Nosifer&family=Open+Sans:wght@400;700&family=Orbitron:wght@400;700;900&family=Oswald:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@400;700;900&family=Road+Rage&family=Roboto+Condensed:wght@400;700&family=Russo+One&display=swap";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }
  }, []);

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
        setResults([]);
        setAnalysisResult('');
        // Trigger Analysis
        performAnalysis(e.target?.result as string, file.type);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performAnalysis = async (base64: string, mimeType: string) => {
      setAnalyzing(true);
      try {
          const analysis = await analyzeImageStyle(base64, mimeType, lang);
          setAnalysisResult(analysis);
          // Auto-fill the custom prompt with the analysis result
          setConfig(prev => ({ ...prev, customPrompt: analysis }));
      } catch (e) {
          console.error(e);
      } finally {
          setAnalyzing(false);
      }
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

  // Masking Logic (Reused)
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
      if (!image) return;
      setLoading(true);
      setError(null);
      setLoadingMessage(t.thumbnailDesign.waitMessage);
      setResults([]);

      try {
          const mask = getMaskBase64();
          // Generate 4 variations
          const promises = Array(4).fill(0).map(() => 
              processImage(
                  ToolType.THUMBNAIL_DESIGN,
                  image.base64,
                  image.file.type,
                  config.customPrompt,
                  { ...config, mask: mask || undefined },
                  additionalAssets.map(a => a.base64)
              )
          );

          const generatedImages = await Promise.all(promises);
          setResults(generatedImages);

          // Save History
          const historyItem: ThumbnailHistoryItem = {
              id: Date.now().toString(),
              originalImage: image.base64,
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
      if (!refinePrompt || !image || results.length === 0) return;
      const updatedPrompt = `${config.customPrompt} \n\n Refinement: ${refinePrompt}`;
      setConfig(prev => ({ ...prev, customPrompt: updatedPrompt }));
      handleProcess();
      setRefinePrompt('');
  };

  const handleReset = () => {
      setImage(null);
      setAdditionalAssets([]);
      setResults([]);
      setAnalysisResult('');
      setConfig({ ...config, textContent: '', customPrompt: '' });
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleDownloadAll = async () => {
      if (results.length === 0) return;
      setLoading(true);
      setLoadingMessage(t.thumbnailDesign.zipGenerating);
      try {
          const zip = new JSZip();
          results.forEach((res, idx) => {
              const data = res.split(',')[1];
              zip.file(`thumbnail_option_${idx + 1}.png`, data, {base64: true});
          });
          const blob = await zip.generateAsync({type: "blob"});
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = "thumbnail_designs.zip";
          link.click();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
          setLoadingMessage('');
      }
  };

  const handleRestore = (item: ThumbnailHistoryItem) => {
      setImage({ file: new File([], "restored"), base64: item.originalImage, width: 0, height: 0 }); // Size will recalc
      setAdditionalAssets(item.additionalAssets.map(b64 => ({ id: Math.random().toString(), file: new File([], "asset"), base64: b64 })));
      setResults(item.results);
      setConfig(item.config);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
        {loading && <LoadingOverlay message={loadingMessage || t.thumbnailDesign.loading} t={t} />}

        {/* --- LEFT: CONTROL PANEL --- */}
        <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                {t.thumbnailDesign.panelTitle}
            </h3>

            {/* 1. Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.styleLabel}</label>
                <select 
                    value={config.style} 
                    onChange={(e) => setConfig({...config, style: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.thumbnailDesign.styles).sort((a,b) => t.thumbnailDesign.styles[a].localeCompare(t.thumbnailDesign.styles[b])).map(key => (
                        <option key={key} value={key}>{t.thumbnailDesign.styles[key]}</option>
                    ))}
                </select>
            </div>

            {/* 2. Text Content */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.contentLabel}</label>
                <input 
                    type="text" 
                    value={config.textContent}
                    onChange={(e) => setConfig({...config, textContent: e.target.value})}
                    placeholder={t.thumbnailDesign.contentPlaceholder}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
            </div>

            {/* 3. Font */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.fontLabel}</label>
                <select 
                    value={config.font} 
                    onChange={(e) => setConfig({...config, font: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.thumbnailDesign.fonts).map(key => (
                        <option key={key} value={key}>{t.thumbnailDesign.fonts[key]}</option>
                    ))}
                </select>
                
                {/* Enhanced Visual Preview of Font */}
                <div className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 text-center flex flex-col items-center justify-center min-h-[80px] shadow-inner transition-colors">
                    <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-widest font-semibold">Preview</p>
                    <span 
                        style={{ 
                            fontFamily: FONT_MAPPING[config.font] || 'sans-serif', 
                            fontSize: '28px', 
                            lineHeight: '1.2',
                            color: config.textColor,
                            textShadow: config.typography === 'bold_outline' ? '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' : 
                                        config.typography === 'neon' ? `0 0 5px #fff, 0 0 10px #fff, 0 0 20px ${config.textColor}, 0 0 30px ${config.textColor}` : 
                                        config.typography === 'shadow' ? '3px 3px 5px rgba(0,0,0,0.5)' : 
                                        config.typography === '3d' ? '0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25)' : 'none'
                        }}
                        className="transition-all duration-300 break-words w-full"
                    >
                        {config.textContent || "VIDEO TITLE"}
                    </span>
                </div>
            </div>

            {/* 4. Typography Style */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.typographyLabel}</label>
                <select 
                    value={config.typography} 
                    onChange={(e) => setConfig({...config, typography: e.target.value})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.thumbnailDesign.typographies).map(key => (
                        <option key={key} value={key}>{t.thumbnailDesign.typographies[key]}</option>
                    ))}
                </select>
            </div>

            {/* 5. Colors */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.colorLabel}</label>
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

            {/* 6. Aspect Ratio */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.aspectRatioLabel}</label>
                <select 
                    value={config.aspectRatio} 
                    onChange={(e) => setConfig({...config, aspectRatio: e.target.value as any})}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                    {Object.keys(t.thumbnailDesign.ratios).map(key => (
                        <option key={key} value={key}>{t.thumbnailDesign.ratios[key]}</option>
                    ))}
                </select>
            </div>

            {/* 7. Quality & Upscale */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.thumbnailDesign.qualityLabel}</label>
                     <select value={config.quality} onChange={(e) => setConfig({...config, quality: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         <option value="keep_original">{t.thumbnailDesign.qualityKeep}</option>
                         <option value="enhance">{t.thumbnailDesign.qualityEnhance}</option>
                     </select>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.thumbnailDesign.upscaleLabel}</label>
                     <select value={config.upscale} onChange={(e) => setConfig({...config, upscale: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-600">
                         {['x1', 'x2', 'x4', 'ultra_hd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                     </select>
                 </div>
            </div>

            {/* 8. Masking Tool */}
            {image && (
                <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.maskTitle}</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEraser(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${!isEraser ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Brush size={12} /> {t.thumbnailDesign.brush}
                        </button>
                        <button onClick={() => setIsEraser(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${isEraser ? 'bg-slate-100 dark:bg-slate-700 border-slate-400' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Eraser size={12} /> {t.thumbnailDesign.eraser}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">{t.thumbnailDesign.brushSize}</span>
                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>
                </div>
            )}

            {/* 9. Custom Prompt */}
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.thumbnailDesign.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.thumbnailDesign.promptPlaceholder}
                    className="w-full p-2 h-20 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
                <p className="text-[10px] text-slate-400 italic">{t.thumbnailDesign.promptExample}</p>
            </div>

            {/* 10. Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading || !image}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 shadow-lg text-base"
                >
                    {t.thumbnailDesign.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.thumbnailDesign.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.thumbnailDesign.btnExit}
                     </button>
                </div>
            </div>

            {/* 11. History */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.thumbnailDesign.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2">
                            <img src={item.results[0]} className="w-10 h-10 object-cover rounded border" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{item.config.style}</div>
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
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.thumbnailDesign.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 relative overflow-y-auto">
                
                {/* Main Image Upload & Masking */}
                <div className="flex-1 flex flex-col min-h-[300px] mb-4">
                    {image ? (
                        <div className="flex flex-col gap-4 h-full">
                            {/* Analysis Panel - Compact & Scrollable */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs max-h-32 overflow-y-auto custom-scrollbar">
                                <h4 className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-1 sticky top-0 bg-blue-50 dark:bg-blue-900/0 backdrop-blur-sm pb-1">
                                    <Sparkles size={14} /> {t.thumbnailDesign.analysisTitle}
                                </h4>
                                {analyzing ? (
                                    <p className="italic text-slate-500">{t.thumbnailDesign.analyzing}</p>
                                ) : (
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{analysisResult}</p>
                                )}
                            </div>

                            <div className="relative flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group min-h-[300px]">
                                <div className="relative max-w-full max-h-full">
                                    <img src={image.base64} className="block max-w-full max-h-[calc(100vh-400px)] object-contain select-none" draggable={false} />
                                    <canvas 
                                        ref={canvasRef}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        className={`absolute inset-0 w-full h-full z-10 touch-none opacity-60 ${isDrawing ? 'cursor-crosshair' : ''}`}
                                    />
                                </div>
                                <button onClick={() => { setImage(null); setIsDrawing(false); setAnalysisResult(''); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-20">
                                    <Trash2 size={14} />
                                </button>
                            </div>
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
                        <Plus size={16} /> {t.thumbnailDesign.uploadAssets}
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
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.thumbnailDesign.outputArea}</div>
            <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                {results.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex-1 p-3 grid grid-cols-2 gap-3 overflow-y-auto">
                            {results.map((res, idx) => (
                                <div key={idx} className="relative w-full h-full bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 group overflow-hidden flex flex-col">
                                    {/* Make sure image fills the container similarly to input */}
                                    <div className="flex-1 relative overflow-hidden">
                                        <img src={res} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center z-10">
                                        <a href={res} download={`thumbnail_option_${idx+1}.png`} className="bg-white text-slate-900 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-gray-100">
                                            <Download size={12} /> {t.thumbnailDesign.download}
                                        </a>
                                    </div>
                                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-1.5 rounded z-10">Opt {idx+1}</div>
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
                                    placeholder={t.thumbnailDesign.refinePlaceholder}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    <Send size={16} />
                                </button>
                            </div>
                            <button onClick={handleDownloadAll} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                <Download size={18} /> {t.thumbnailDesign.downloadAll}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <p>{t.thumbnailDesign.emptyOutput}</p>
                    </div>
                )}
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default ThumbnailDesignTool;
