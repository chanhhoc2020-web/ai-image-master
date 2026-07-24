
import React, { useState, useRef } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, IdPhotoConfig } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { Camera, RefreshCcw, LogOut, RotateCcw, Trash2, ArrowRight, Download, Upload, Send, Plus, Printer } from 'lucide-react';

interface IdPhotoToolProps {
  t: any;
}

// Specific history interface
interface IdPhotoHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: IdPhotoConfig;
    prompt: string;
    timestamp: number;
}

const IdPhotoTool: React.FC<IdPhotoToolProps> = ({ t }) => {
  // --- STATE ---
  const [image, setImage] = useState<{file: File, base64: string} | null>(null);
  const [customAttireImage, setCustomAttireImage] = useState<{file: File, base64: string} | null>(null);
  const [additionalAssets, setAdditionalAssets] = useState<{id: string, file: File, base64: string}[]>([]);
  
  // History State
  const [history, setHistory] = useState<IdPhotoHistoryItem[]>([]);
  
  // Configuration
  const [config, setConfig] = useState<IdPhotoConfig>({
    size: '3x4',
    bgColorType: 'white',
    customBgColor: '#ffffff',
    attireMode: 'original',
    attirePreset: 'man_shirt',
    hairStyle: 'auto',
    keepFeatures: true,
    smoothSkin: true,
  });

  const [prompt, setPrompt] = useState(''); // Custom user prompt (Left Panel)
  const [refinePrompt, setRefinePrompt] = useState(''); // Refine result prompt (Right Panel)
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<string | null>(null);

  // Ref for changing main image
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage({file, base64: reader.result as string});
        setCurrentResult(null); 
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleProcess = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Strict System Instruction as requested
      const systemInstruction = " REQUIREMENT: The face must be serious, not smiling, professional ID photo standard, but maintain a beautiful/handsome aura. Focus on high quality, sharp eyes, and confident expression.";
      
      // 2. Combine user prompt with system instruction
      // If user enters prompt, it takes priority in the description, but we still append the requirement.
      const finalPrompt = (prompt ? `User Custom Instruction: ${prompt}. ` : "Create a professional ID Photo. ") + systemInstruction;

      // 3. Gather references
      const refs = [];
      if (config.attireMode === 'custom_upload' && customAttireImage) {
          refs.push(customAttireImage.base64);
      }
      // Add additional assets
      refs.push(...additionalAssets.map(a => a.base64));

      // 4. Call API
      // Note: passing the first ref as the main refImage param, and logic inside processImage might need to handle arrays if multiple refs are strictly supported by the tool type. 
      // For ID Photo, processImage usually takes one ref for attire. We'll pass the first one found.
      const output = await processImage(
        ToolType.ID_PHOTO, 
        image.base64, 
        image.file.type, 
        finalPrompt, 
        config,
        refs.length > 0 ? refs[0] : undefined
      );

      // 5. Save History
      const newItem: IdPhotoHistoryItem = {
          id: Date.now().toString(),
          originalImage: image.base64,
          resultImage: output,
          config: { ...config },
          prompt: prompt,
          timestamp: Date.now()
      };

      setHistory(prev => [newItem, ...prev]);
      setCurrentResult(output);
      setRefinePrompt('');

    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = () => {
      if (!refinePrompt || !image || !currentResult) return;
      
      // Update prompt to include refinement
      const updatedPrompt = `${prompt} \n\n Refinement: ${refinePrompt}`;
      setPrompt(updatedPrompt); // Update UI
      
      // Trigger process (simulating refinement by re-running with new instructions on original image for better quality)
      handleProcess();
  };

  const handleRestoreHistory = (item: IdPhotoHistoryItem) => {
      setImage({ file: new File([], "restored"), base64: item.originalImage });
      setCurrentResult(item.resultImage);
      setConfig(item.config);
      setPrompt(item.prompt);
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleReset = () => {
      setImage(null);
      setCurrentResult(null);
      setPrompt('');
      setAdditionalAssets([]);
      setConfig({
        size: '3x4',
        bgColorType: 'white',
        customBgColor: '#ffffff',
        attireMode: 'original',
        attirePreset: 'man_shirt',
        hairStyle: 'auto',
        keepFeatures: true,
        smoothSkin: true,
      });
  };

  // Logic to generate the print sheet (Client-side Canvas)
  const handleDownload = async (layout: 'single' | '10x15' | '13x18' | 'a4') => {
    if (!currentResult) return;

    if (layout === 'single') {
        const link = document.createElement('a');
        link.href = currentResult;
        link.download = 'id_photo.png';
        link.click();
        return;
    }

    const img = new Image();
    img.src = currentResult;
    await new Promise((resolve) => { img.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Defined paper sizes (approx 300 DPI)
    let paperW = 0, paperH = 0;
    if (layout === '10x15') { paperW = 1200; paperH = 1800; }
    else if (layout === '13x18') { paperW = 1500; paperH = 2100; }
    else if (layout === 'a4') { paperW = 2480; paperH = 3508; }

    canvas.width = paperW;
    canvas.height = paperH;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paperW, paperH);

    // Photo dimensions (Approx pixels based on 300 DPI)
    let photoW = 354, photoH = 472; // Default 3x4
    if (config.size === '2x3') { photoW = 236; photoH = 354; }
    if (config.size === '4x6') { photoW = 472; photoH = 709; }
    if (config.size === '5x5') { photoW = 590; photoH = 590; }

    const gap = 30;
    const cols = Math.floor((paperW - gap) / (photoW + gap));
    const rows = Math.floor((paperH - gap) / (photoH + gap));
    
    // Calculate start positions to center grid
    const startX = (paperW - (cols * photoW + (cols - 1) * gap)) / 2;
    const startY = (paperH - (rows * photoH + (rows - 1) * gap)) / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * (photoW + gap);
            const y = startY + r * (photoH + gap);
            ctx.drawImage(img, x, y, photoW, photoH);
            
            // Optional: Light gray cut lines
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, photoW, photoH);
        }
    }

    const link = document.createElement('a');
    link.download = `print_layout_${layout}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="h-full min-h-[600px] text-slate-800 dark:text-slate-100">
      {loading && <LoadingOverlay message={t.idPhoto.loading} t={t} />}
      
      {/* 3-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
          
          {/* --- I. LEFT: CONTROL PANEL (3 cols) --- */}
          <div className="xl:col-span-3 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar">
              <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                 <Camera className="text-blue-600" />
                 {t.idPhoto.panelTitle}
              </h3>

              <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase text-slate-500">{t.idPhoto.detailedSettings}</h4>

                  {/* 1. Size */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.sizeLabel}</label>
                      <div className="flex flex-wrap gap-2">
                          {(['2x3', '3x4', '4x6', '5x5'] as const).map(size => (
                              <label key={size} className={`flex-1 flex items-center justify-center cursor-pointer border rounded-lg py-2 px-1 text-xs font-medium transition-all ${config.size === size ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                  <input type="radio" name="size" checked={config.size === size} onChange={() => setConfig({...config, size})} className="hidden" />
                                  {size}
                              </label>
                          ))}
                      </div>
                  </div>

                  {/* 2. Attire */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.attireLabel}</label>
                      <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-2">
                          {(['original', 'preset', 'custom_upload'] as const).map(mode => (
                              <button 
                                  key={mode}
                                  onClick={() => setConfig({...config, attireMode: mode})}
                                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${config.attireMode === mode ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                              >
                                  {mode === 'original' ? t.idPhoto.modeOriginal : mode === 'preset' ? t.idPhoto.modePreset : t.idPhoto.modeUpload}
                              </button>
                          ))}
                      </div>
                      {config.attireMode === 'preset' && (
                          <select value={config.attirePreset} onChange={(e) => setConfig({...config, attirePreset: e.target.value})} className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-900 dark:border-slate-600">
                              {Object.entries(t.idPhoto.attirePreset).map(([k,v]) => <option key={k} value={k}>{v as string}</option>)}
                          </select>
                      )}
                      {config.attireMode === 'custom_upload' && (
                          <label className="flex items-center justify-center gap-2 border border-dashed p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">
                              <Upload size={14} /> {t.idPhoto.selectAttireImg}
                              <input type="file" className="hidden" onChange={(e) => { if(e.target.files?.[0]) { const f=e.target.files[0]; const r=new FileReader(); r.onload=ev=>setCustomAttireImage({file:f, base64:ev.target?.result as string}); r.readAsDataURL(f); }}} />
                              {customAttireImage && <span className="text-green-500 text-[10px] font-bold">✓</span>}
                          </label>
                      )}
                  </div>

                  {/* 3. Hair */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.hairLabel}</label>
                      <div className="grid grid-cols-2 gap-2">
                          {(['auto', 'front', 'back', 'original'] as const).map(style => (
                              <label key={style} className={`flex items-center justify-center gap-1 cursor-pointer border rounded-lg py-1.5 px-2 text-[10px] font-medium transition-all ${config.hairStyle === style ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'border-slate-200 dark:border-slate-600'}`}>
                                  <input type="radio" name="hair" checked={config.hairStyle === style} onChange={() => setConfig({...config, hairStyle: style})} className="hidden" />
                                  {style === 'auto' ? t.idPhoto.hairAuto : style === 'front' ? t.idPhoto.hairFront : style === 'back' ? t.idPhoto.hairBack : t.idPhoto.hairOriginal}
                              </label>
                          ))}
                      </div>
                  </div>

                  {/* 4. Quick Tools (Checkboxes) */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.quickTools}</label>
                      <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="checkbox" checked={config.smoothSkin} onChange={(e) => setConfig({...config, smoothSkin: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                              {t.idPhoto.smoothSkin}
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="checkbox" checked={true} readOnly className="rounded text-blue-600 focus:ring-blue-500 opacity-50" />
                              {t.idPhoto.autoColor}
                          </label>
                      </div>
                  </div>

                  {/* 5. Background */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.bgLabel}</label>
                      <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="checkbox" checked={config.bgColorType === 'white'} onChange={() => setConfig({...config, bgColorType: 'white'})} className="rounded-full text-blue-600 focus:ring-blue-500" />
                              {t.idPhoto.bgWhite}
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="checkbox" checked={config.bgColorType === 'blue'} onChange={() => setConfig({...config, bgColorType: 'blue'})} className="rounded-full text-blue-600 focus:ring-blue-500" />
                              {t.idPhoto.bgBlue}
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="checkbox" checked={config.bgColorType === 'custom'} onChange={() => setConfig({...config, bgColorType: 'custom'})} className="rounded-full text-blue-600 focus:ring-blue-500" />
                              {t.idPhoto.bgCustom}
                              {config.bgColorType === 'custom' && (
                                  <input type="color" value={config.customBgColor} onChange={(e) => setConfig({...config, customBgColor: e.target.value})} className="w-6 h-6 p-0 border rounded ml-auto" />
                              )}
                          </label>
                      </div>
                  </div>

                  {/* 6. Custom Prompt */}
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.idPhoto.customLabel}</label>
                      <textarea 
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={t.idPhoto.customPlaceholder}
                          className="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg h-20 resize-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900"
                      />
                      <p className="text-[10px] text-slate-400 italic">{t.idPhoto.customNote}</p>
                  </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                  <Button 
                      onClick={handleProcess}
                      disabled={!image || loading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 shadow-lg text-base font-bold"
                  >
                      {t.idPhoto.btnProcess} <ArrowRight size={18} className="ml-2" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                          <RefreshCcw size={14} /> {t.idPhoto.btnReset}
                      </button>
                      <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                          <LogOut size={14} /> {t.idPhoto.btnExit}
                      </button>
                  </div>
              </div>

              {/* History */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.idPhoto.history}</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {history.map(item => (
                          <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2 group">
                              <img src={item.resultImage} className="w-10 h-10 object-cover rounded" />
                              <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold truncate">ID Photo ({item.config.size})</div>
                                  <div className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</div>
                                  <div className="flex gap-2 mt-1">
                                      <button onClick={() => handleRestoreHistory(item)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                          <RotateCcw size={10} /> Restore
                                      </button>
                                      <button onClick={() => handleDeleteHistory(item.id)} className="text-[10px] text-red-600 hover:underline flex items-center gap-1">
                                          <Trash2 size={10} /> Delete
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {history.length === 0 && <p className="text-xs text-slate-400 italic text-center">{t.idPhoto.noHistory}</p>}
                  </div>
              </div>
          </div>

          {/* --- II. CENTER: INPUT AREA (5 cols) --- */}
          <div className="xl:col-span-5 flex flex-col gap-3">
              <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.idPhoto.inputArea}</div>
              <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-6 relative overflow-hidden">
                  
                  {/* Main Image Upload */}
                  <div className="flex-1 flex flex-col justify-center items-center">
                      <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                      
                      {image ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center">
                              <img src={image.base64} className="max-w-full max-h-[400px] object-contain shadow-lg rounded-lg" alt="Original" />
                              <button onClick={() => fileInputRef.current?.click()} className="absolute top-2 right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-lg">
                                  <RefreshCcw size={16} />
                              </button>
                          </div>
                      ) : (
                          <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="cursor-pointer text-center group"
                          >
                              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                  <Plus size={40} className="text-blue-500" />
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 font-bold">{t.common.dragDrop}</p>
                              <p className="text-xs text-slate-400 mt-2">{t.common.formats}</p>
                          </div>
                      )}
                  </div>

                  {/* Additional Assets Upload */}
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <label className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Plus size={16} /> {t.idPhoto.uploadRef}
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                          <label className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              <Plus size={20} className="text-slate-400" />
                              <input type="file" multiple accept="image/*" className="hidden" onChange={handleAssetUpload} />
                          </label>
                          {additionalAssets.map(asset => (
                              <div key={asset.id} className="flex-shrink-0 w-16 h-16 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden relative group bg-white dark:bg-slate-800">
                                  <img src={asset.base64} className="w-full h-full object-cover" />
                                  <button onClick={() => setAdditionalAssets(prev => prev.filter(a => a.id !== asset.id))} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>

          {/* --- III. RIGHT: OUTPUT AREA (4 cols) --- */}
          <div className="xl:col-span-4 flex flex-col gap-3">
              <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.idPhoto.outputArea}</div>
              <div className="flex-1 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                  
                  {currentResult ? (
                      <div className="w-full h-full flex flex-col">
                          {/* Result Image */}
                          <div className="flex-1 p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] overflow-hidden">
                              <img src={currentResult} className="max-w-full max-h-[500px] object-contain shadow-2xl" alt="Result" />
                          </div>
                          
                          {/* Output Controls */}
                          <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                              {/* Refine Input */}
                              <div className="flex gap-2">
                                  <input 
                                      type="text"
                                      value={refinePrompt}
                                      onChange={(e) => setRefinePrompt(e.target.value)}
                                      placeholder={t.idPhoto.refinePlaceholder}
                                      className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                      onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                  />
                                  <button onClick={handleRefine} disabled={loading || !refinePrompt} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                      <Send size={16} />
                                  </button>
                              </div>

                              {/* Download Buttons Section */}
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500 mb-2 block flex items-center gap-1">
                                      <Printer size={12} /> {t.idPhoto.downloadTitle}
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                      <button 
                                          onClick={() => handleDownload('single')} 
                                          className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                      >
                                          <Download size={14} /> {t.idPhoto.layoutSingle}
                                      </button>
                                      <button 
                                          onClick={() => handleDownload('10x15')} 
                                          className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                          <Download size={14} /> {t.idPhoto.layout10x15}
                                      </button>
                                      <button 
                                          onClick={() => handleDownload('13x18')} 
                                          className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                          <Download size={14} /> {t.idPhoto.layout13x18}
                                      </button>
                                      <button 
                                          onClick={() => handleDownload('a4')} 
                                          className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                          <Download size={14} /> {t.idPhoto.layoutA4}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <p>{t.common.noResult}</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
      
      {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default IdPhotoTool;
