
import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { ToolType, BeforeAfterConfig, TextOverlay, BeforeAfterHistoryItem, ImageResizerConfig } from '../types';
import { processImage } from '../services/geminiService';
import LoadingOverlay from './LoadingOverlay';
import { Button } from './Button';
import { ArrowRight, Download, RefreshCcw, LogOut, Plus, Trash2, Send, RotateCcw, Brush, Eraser, Type, Layers, Maximize, Move, Upload, ZoomIn, ZoomOut, MousePointer2, Bold, Italic, Palette, Settings2, Sparkles } from 'lucide-react';
import { FONTS } from '../constants';

interface BeforeAfterToolProps {
  t: any;
}

interface LogoElement {
  id: string;
  file: File;
  base64: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

// Interface for images that can be transformed
interface EditableImage {
    file: File;
    base64: string;
    width: number;
    height: number;
    // Transform properties
    x: number; // Offset X
    y: number; // Offset Y
    scale: number; // Multiplier (1 = default fit)
    rotation: number; // Degrees
}

const BeforeAfterTool: React.FC<BeforeAfterToolProps> = ({ t }) => {
  // --- STATE ---
  
  // Images (Editable)
  const [beforeImage, setBeforeImage] = useState<EditableImage | null>(null);
  const [afterImage, setAfterImage] = useState<EditableImage | null>(null);
  const [frameImage, setFrameImage] = useState<{file: File, base64: string} | null>(null);
  
  // Multiple Logos
  const [logos, setLogos] = useState<LogoElement[]>([]);
  
  // Config
  const [config, setConfig] = useState<BeforeAfterConfig>({
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    ppi: 96,
    arrangement: 'left-right',
    padding: 20,
    gap: 10,
    backgroundColor: '#ffffff',
    borderColor: '#000000',
    borderWidth: 0,
    frameStyle: 'custom',
    logoOpacity: 100,
    customPrompt: '',
    textElements: [
        { id: 't1', text: 'BEFORE', x: 25, y: 90, fontFamily: "'Roboto', sans-serif", fontSize: 40, color: '#ffffff', isBold: true, isItalic: false, hasShadow: true, effect: 'drop_shadow' },
        { id: 't2', text: 'AFTER', x: 75, y: 90, fontFamily: "'Roboto', sans-serif", fontSize: 40, color: '#ffffff', isBold: true, isItalic: false, hasShadow: true, effect: 'drop_shadow' }
    ]
  });

  // UI State
  const [activeId, setActiveId] = useState<string | null>(null); 
  const [activeType, setActiveType] = useState<'text' | 'logo' | 'before' | 'after' | null>(null);
  const [zoom, setZoom] = useState(0.5); 
  
  const [refinePrompt, setRefinePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(null); 
  const [history, setHistory] = useState<BeforeAfterHistoryItem[]>([]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dragging State
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Store layout areas for hit testing
  const layoutAreas = useRef<{
      before: { x: number, y: number, w: number, h: number } | null,
      after: { x: number, y: number, w: number, h: number } | null
  }>({ before: null, after: null });

  // --- HANDLERS ---

  const handleImageUpload = (type: 'before' | 'after' | 'frame' | 'logo', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const baseData = {
          file,
          base64: e.target?.result as string,
          width: img.naturalWidth,
          height: img.naturalHeight
        };

        if (type === 'before') {
            setBeforeImage({ ...baseData, x: 0, y: 0, scale: 1, rotation: 0 });
            setActiveType('before');
        }
        else if (type === 'after') {
            setAfterImage({ ...baseData, x: 0, y: 0, scale: 1, rotation: 0 });
            setActiveType('after');
        }
        else if (type === 'frame') setFrameImage({file, base64: baseData.base64});
        else if (type === 'logo') {
            const newLogo: LogoElement = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                file,
                base64: baseData.base64,
                width: baseData.width,
                height: baseData.height,
                x: 0.5,
                y: 0.5,
                scale: 0.2,
                rotation: 0,
                opacity: 1
            };
            setLogos(prev => [...prev, newLogo]);
            setActiveId(newLogo.id);
            setActiveType('logo');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- CANVAS LOGIC ---

  const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Setup Canvas Dimensions
      canvas.width = config.width;
      canvas.height = config.height;

      // 2. Fill Background
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Draw Generated AI Background / Reference Frame if exists
      if (generatedBackground || (config.frameStyle === 'custom' && frameImage)) {
          const bgSrc = generatedBackground || frameImage?.base64;
          if (bgSrc) {
              const bgImg = new Image();
              bgImg.src = bgSrc;
              if (bgImg.complete) {
                  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
              } 
          }
      }

      // --- Helper: Draw Editable Image ---
      const drawEditableImage = (imgData: EditableImage | null, area: {x: number, y: number, w: number, h: number}, type: 'before' | 'after', shouldClip = true) => {
          if (!imgData) {
              // Placeholder
              ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
              ctx.fillRect(area.x, area.y, area.w, area.h);
              ctx.strokeStyle = '#94a3b8';
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(area.x, area.y, area.w, area.h);
              ctx.setLineDash([]);
              ctx.font = '20px Arial';
              ctx.fillStyle = '#94a3b8';
              ctx.textAlign = 'center';
              ctx.fillText(`Upload ${type === 'before' ? 'Before' : 'After'}`, area.x + area.w/2, area.y + area.h/2);
              return;
          }

          const img = new Image();
          img.src = imgData.base64;
          if (!img.complete) return;

          ctx.save();
          
          if (shouldClip) {
              ctx.beginPath();
              ctx.rect(area.x, area.y, area.w, area.h);
              ctx.clip();
          }

          // Calculate "Cover" scaling first
          const scaleW = area.w / imgData.width;
          const scaleH = area.h / imgData.height;
          const baseScale = Math.max(scaleW, scaleH);
          
          const drawnW = imgData.width * baseScale * imgData.scale;
          const drawnH = imgData.height * baseScale * imgData.scale;

          // Center and Apply Transform
          const centerX = area.x + area.w / 2;
          const centerY = area.y + area.h / 2;

          ctx.translate(centerX + imgData.x, centerY + imgData.y);
          ctx.rotate((imgData.rotation * Math.PI) / 180);
          
          ctx.drawImage(img, -drawnW / 2, -drawnH / 2, drawnW, drawnH);

          ctx.restore();

          // Selection Border
          if (activeType === type) {
              ctx.save();
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 4;
              if (shouldClip) {
                  ctx.strokeRect(area.x, area.y, area.w, area.h);
              }
              ctx.restore();
          } else if (config.borderWidth > 0 && shouldClip) {
              ctx.strokeStyle = config.borderColor;
              ctx.lineWidth = config.borderWidth;
              ctx.strokeRect(area.x, area.y, area.w, area.h);
          }
      };

      // 4. Calculate Layout
      const p = config.padding;
      const g = config.gap;
      const availW = canvas.width - (p * 2);
      const availH = canvas.height - (p * 2);

      let beforeArea, afterArea;

      if (config.arrangement === 'left-right') {
          const imgW = (availW - g) / 2;
          beforeArea = { x: p, y: p, w: imgW, h: availH };
          afterArea = { x: p + imgW + g, y: p, w: imgW, h: availH };
          drawEditableImage(beforeImage, beforeArea, 'before');
          drawEditableImage(afterImage, afterArea, 'after');
      } 
      else if (config.arrangement === 'top-bottom') {
          const imgH = (availH - g) / 2;
          beforeArea = { x: p, y: p, w: availW, h: imgH };
          afterArea = { x: p, y: p + imgH + g, w: availW, h: imgH };
          drawEditableImage(beforeImage, beforeArea, 'before');
          drawEditableImage(afterImage, afterArea, 'after');
      }
      else if (config.arrangement === 'diagonal') {
          // Full rects
          beforeArea = { x: p, y: p, w: availW, h: availH };
          afterArea = { x: p, y: p, w: availW, h: availH };

          // Before (Top Left)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p, p);
          ctx.lineTo(p + availW, p);
          ctx.lineTo(p, p + availH);
          ctx.closePath();
          ctx.clip();
          drawEditableImage(beforeImage, beforeArea, 'before', false);
          ctx.restore();

          // After (Bottom Right)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p + availW, p);
          ctx.lineTo(p + availW, p + availH);
          ctx.lineTo(p, p + availH);
          ctx.closePath();
          ctx.clip();
          drawEditableImage(afterImage, afterArea, 'after', false);
          ctx.restore();

          // Border Line
          if (config.borderWidth > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(p + availW, p);
              ctx.lineTo(p, p + availH);
              ctx.strokeStyle = config.borderColor;
              ctx.lineWidth = config.borderWidth;
              ctx.stroke();
              ctx.strokeRect(p, p, availW, availH);
              ctx.restore();
          }
      }

      layoutAreas.current = { before: beforeArea || null, after: afterArea || null };

      // 5. Draw Logos
      logos.forEach(logoObj => {
          const logo = new Image();
          logo.src = logoObj.base64;
          if (logo.complete) {
              const logoW = logo.width;
              const logoH = logo.height;
              const targetW = canvas.width * logoObj.scale;
              const targetH = targetW * (logoH / logoW);
              const lx = (canvas.width * logoObj.x);
              const ly = (canvas.height * logoObj.y);
              
              ctx.save();
              ctx.translate(lx, ly);
              ctx.rotate((logoObj.rotation * Math.PI) / 180);
              ctx.globalAlpha = logoObj.opacity;
              ctx.drawImage(logo, -targetW/2, -targetH/2, targetW, targetH);
              if (activeType === 'logo' && activeId === logoObj.id) {
                  ctx.strokeStyle = '#3b82f6';
                  ctx.lineWidth = 2;
                  ctx.setLineDash([5, 3]);
                  ctx.strokeRect(-targetW/2 - 5, -targetH/2 - 5, targetW + 10, targetH + 10);
              }
              ctx.restore();
          }
      });

      // 6. Draw Text
      config.textElements.forEach(el => {
          ctx.save();
          const tx = (el.x / 100) * canvas.width;
          const ty = (el.y / 100) * canvas.height;
          let fontStr = '';
          if (el.isItalic) fontStr += 'italic ';
          if (el.isBold) fontStr += 'bold ';
          fontStr += `${el.fontSize}px ${el.fontFamily}`;
          ctx.font = fontStr;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const effect = el.effect || 'none';
          
          // Apply Shadow if hasShadow is true OR effect is drop_shadow
          if (effect === 'drop_shadow' || (effect === 'none' && el.hasShadow)) {
              ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.fillStyle = el.color; ctx.fillText(el.text, tx, ty);
          } else if (effect === 'outline') {
              ctx.strokeStyle = 'black'; ctx.lineWidth = 4; ctx.strokeText(el.text, tx, ty); ctx.fillStyle = el.color; ctx.fillText(el.text, tx, ty);
          } else if (effect === 'glow') {
              ctx.shadowColor = el.color; ctx.shadowBlur = 15; ctx.fillStyle = el.color; ctx.fillText(el.text, tx, ty);
          } else if (effect === 'neon') {
              ctx.shadowColor = el.color; ctx.shadowBlur = 20; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeText(el.text, tx, ty); ctx.fillText(el.text, tx, ty);
          } else {
              ctx.fillStyle = el.color; ctx.fillText(el.text, tx, ty);
          }
          
          if (activeType === 'text' && activeId === el.id) {
              const metrics = ctx.measureText(el.text);
              ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
              ctx.strokeRect(tx - metrics.width/2 - 10, ty - el.fontSize/2 - 10, metrics.width + 20, el.fontSize + 20);
          }
          ctx.restore();
      });
  };

  useEffect(() => {
      setTimeout(drawCanvas, 100);
  }, [config, beforeImage, afterImage, frameImage, logos, generatedBackground, activeId, activeType]);


  // --- INTERACTION LOGIC ---

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      let found = false;

      // 1. Logos
      for (let i = logos.length - 1; i >= 0; i--) {
          const logoObj = logos[i];
          const logoW = canvas.width * logoObj.scale;
          const logoH = logoW * (logoObj.height / logoObj.width);
          const lx = canvas.width * logoObj.x;
          const ly = canvas.height * logoObj.y;
          if (x >= lx - logoW/2 && x <= lx + logoW/2 && y >= ly - logoH/2 && y <= ly + logoH/2) {
              setActiveId(logoObj.id);
              setActiveType('logo');
              isDragging.current = true;
              dragStartPos.current = { x, y };
              found = true;
              break;
          }
      }

      // 2. Text
      if (!found) {
          const clickedText = config.textElements.find(el => {
              const tx = (el.x / 100) * canvas.width;
              const ty = (el.y / 100) * canvas.height;
              const tw = el.text.length * el.fontSize * 0.6;
              const th = el.fontSize;
              return x >= tx - tw/2 && x <= tx + tw/2 && y >= ty - th/2 && y <= ty + th/2;
          });
          if (clickedText) {
              setActiveId(clickedText.id);
              setActiveType('text');
              isDragging.current = true;
              dragStartPos.current = { x, y };
              found = true;
          }
      }

      // 3. Background Images
      if (!found && layoutAreas.current.before && layoutAreas.current.after) {
          const ba = layoutAreas.current.before;
          const aa = layoutAreas.current.after;

          if (x >= ba.x && x <= ba.x + ba.w && y >= ba.y && y <= ba.y + ba.h) {
              if (config.arrangement === 'diagonal') {
                  if (x + y < ba.w + ba.h) { 
                      setActiveType('before'); setActiveId(null); isDragging.current = true; dragStartPos.current = { x, y }; found = true;
                  } else {
                      setActiveType('after'); setActiveId(null); isDragging.current = true; dragStartPos.current = { x, y }; found = true;
                  }
              } else {
                  setActiveType('before'); setActiveId(null); isDragging.current = true; dragStartPos.current = { x, y }; found = true;
              }
          } else if (x >= aa.x && x <= aa.x + aa.w && y >= aa.y && y <= aa.y + aa.h) {
              setActiveType('after'); setActiveId(null); isDragging.current = true; dragStartPos.current = { x, y }; found = true;
          }
      }

      if (!found) {
          setActiveId(null);
          setActiveType(null);
      }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const currentX = (e.clientX - rect.left) * scaleX;
      const currentY = (e.clientY - rect.top) * scaleY;
      
      const deltaX = currentX - dragStartPos.current.x;
      const deltaY = currentY - dragStartPos.current.y;

      if (activeType === 'text' && activeId) {
          const newXPercent = (currentX / canvas.width) * 100;
          const newYPercent = (currentY / canvas.height) * 100;
          setConfig(prev => ({
              ...prev,
              textElements: prev.textElements.map(el => 
                  el.id === activeId ? { ...el, x: newXPercent, y: newYPercent } : el
              )
          }));
      } else if (activeType === 'logo' && activeId) {
          const newXPercent = currentX / canvas.width;
          const newYPercent = currentY / canvas.height;
          setLogos(prev => prev.map(l => l.id === activeId ? { ...l, x: newXPercent, y: newYPercent } : l));
      } else if (activeType === 'before' && beforeImage) {
          setBeforeImage(prev => prev ? { ...prev, x: prev.x + deltaX, y: prev.y + deltaY } : null);
          dragStartPos.current = { x: currentX, y: currentY };
      } else if (activeType === 'after' && afterImage) {
          setAfterImage(prev => prev ? { ...prev, x: prev.x + deltaX, y: prev.y + deltaY } : null);
          dragStartPos.current = { x: currentX, y: currentY };
      }
  };

  const handleCanvasMouseUp = () => {
      isDragging.current = false;
  };

  // --- EDITING HELPERS ---
  const updateActiveText = (key: keyof TextOverlay, value: any) => {
      if (!activeId || activeType !== 'text') return;
      setConfig(prev => ({
          ...prev,
          textElements: prev.textElements.map(el => el.id === activeId ? { ...el, [key]: value } : el)
      }));
  };

  const updateActiveLogo = (key: keyof LogoElement, value: any) => {
      if (!activeId || activeType !== 'logo') return;
      setLogos(prev => prev.map(l => l.id === activeId ? { ...l, [key]: value } : l));
  };

  const updateActiveImage = (key: keyof EditableImage, value: any) => {
      if (activeType === 'before') {
          setBeforeImage(prev => prev ? { ...prev, [key]: value } : null);
      } else if (activeType === 'after') {
          setAfterImage(prev => prev ? { ...prev, [key]: value } : null);
      }
  };

  const addTextElement = () => {
      const newId = Date.now().toString();
      const newEl: TextOverlay = {
          id: newId, text: 'New Text', x: 50, y: 50, fontFamily: "'Roboto', sans-serif", fontSize: 40,
          color: '#ffffff', isBold: true, isItalic: false, hasShadow: true, effect: 'none'
      };
      setConfig(prev => ({...prev, textElements: [...prev.textElements, newEl]}));
      setActiveId(newId);
      setActiveType('text');
  };

  const deleteActiveElement = () => {
      if (activeType === 'text' && activeId) {
          setConfig(prev => ({ ...prev, textElements: prev.textElements.filter(el => el.id !== activeId) }));
          setActiveId(null); setActiveType(null);
      } else if (activeType === 'logo' && activeId) {
          setLogos(prev => prev.filter(l => l.id !== activeId));
          setActiveId(null); setActiveType(null);
      }
  };

  const generateBackground = async (styleToUse: string) => {
      setLoading(true); setError(null);
      setLoadingMessage("AI đang tạo nền...");
      try {
          const prompt = `Generate a background texture for comparison. Style: ${styleToUse}. Ratio: ${config.aspectRatio}. No text.`;
          const bgOutput = await processImage(ToolType.TEXT_TO_IMAGE, null, null, prompt, { 
              width: config.width.toString(), height: config.height.toString(), ppi: config.ppi, style: 'none', aspectRatio: config.aspectRatio 
          });
          setGeneratedBackground(bgOutput);
      } catch (err: any) {
          setError(err.message || t.common.error);
      } finally { setLoading(false); setLoadingMessage(''); }
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStyle = e.target.value;
      setConfig(prev => ({ ...prev, frameStyle: newStyle }));
      if (newStyle !== 'custom') generateBackground(newStyle);
  };

  const handleProcess = async () => {
      const hasCustomPrompt = config.customPrompt && config.customPrompt.trim().length > 0;
      const isPresetStyle = config.frameStyle !== 'custom';

      // Generate background if custom prompt exists OR a preset style is selected
      if (hasCustomPrompt || isPresetStyle) {
          setLoading(true); setError(null);
          setLoadingMessage("AI đang xử lý layout...");
          try {
              let prompt = "";
              if (hasCustomPrompt) {
                  prompt = `Generate a professional background layout for a Before/After image comparison. 
                  User Description: "${config.customPrompt}". 
                  Specifications: Ratio ${config.aspectRatio}. 
                  Requirement: Suitable as a background frame, maintain visual balance.`;
              } else {
                  prompt = `Generate a background texture for comparison. Style: ${config.frameStyle}. Ratio: ${config.aspectRatio}. No text.`;
              }

              const bgOutput = await processImage(
                  ToolType.TEXT_TO_IMAGE, 
                  null, 
                  null, 
                  prompt, 
                  { 
                      width: config.width.toString(), 
                      height: config.height.toString(), 
                      ppi: config.ppi, 
                      style: 'none', 
                      aspectRatio: config.aspectRatio 
                  }
              );
              setGeneratedBackground(bgOutput);
          } catch (err: any) {
              setError(err.message || t.common.error);
          } finally { 
              setLoading(false); 
              setLoadingMessage('');
          }
      }

      // Delay history capture slightly to allow React state/canvas to update
      setTimeout(() => {
          const canvas = canvasRef.current;
          const resultUrl = canvas ? canvas.toDataURL('image/png') : '';
          
          const historyItem: BeforeAfterHistoryItem = {
              id: Date.now().toString(),
              beforeImage: beforeImage?.base64,
              afterImage: afterImage?.base64,
              resultImage: resultUrl,
              config: config,
              timestamp: Date.now()
          };
          
          setHistory(prev => [historyItem, ...prev]);
      }, 500);
  };

  const handleDownload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentBase64 = canvas.toDataURL('image/png');

      // AI Upscale Logic if PPI > 96
      if (config.ppi > 96) {
          setLoading(true);
          setLoadingMessage(`AI đang tăng độ phân giải lên ${config.ppi} PPI...`);
          try {
              // Calculate target dimensions
              // We assume standard screen PPI is ~96. 
              const scaleFactor = config.ppi / 96;
              const targetW = Math.round(config.width * scaleFactor);
              const targetH = Math.round(config.height * scaleFactor);

              const prompt = `Upscale this layout image to ${targetW}x${targetH} pixels (Resolution ${config.ppi} PPI). Maintain exact text clarity, layout structure, and image details. This is a print-ready export.`;

              // Use Image Resizer Tool logic via processImage
              const resizerConfig: ImageResizerConfig = {
                  mode: 'single',
                  targetWidth: targetW.toString(),
                  targetHeight: targetH.toString(),
                  maintainAspectRatio: true,
                  ppi: config.ppi,
                  enhancements: { lightBalance: true, denoise: true, hdr: false, sharpen: true },
                  customPrompt: "High fidelity upscale for print."
              };

              const upscaledImage = await processImage(
                  ToolType.IMAGE_RESIZER,
                  currentBase64,
                  'image/png',
                  prompt,
                  resizerConfig
              );

              const link = document.createElement('a');
              link.download = `before_after_${config.ppi}ppi_upscaled.png`;
              link.href = upscaledImage;
              link.click();

          } catch (e: any) {
              console.error(e);
              setError("Lỗi khi tăng độ phân giải. Đang tải bản gốc...");
              // Fallback
              const link = document.createElement('a');
              link.download = 'before_after_result.png';
              link.href = currentBase64;
              link.click();
          } finally {
              setLoading(false);
              setLoadingMessage('');
          }
      } else {
          // Standard Download
          const link = document.createElement('a');
          link.download = 'before_after_result.png';
          link.href = currentBase64;
          link.click();
      }
  };

  const handleReset = () => {
      setBeforeImage(null); setAfterImage(null); setFrameImage(null); setLogos([]); setGeneratedBackground(null);
      setConfig(prev => ({ ...prev, customPrompt: '', textElements: [] }));
  };

  const handleRestore = (item: BeforeAfterHistoryItem) => {
      setConfig(item.config);
      
      // Restore Images if present
      if (item.beforeImage) {
          const img = new Image();
          img.src = item.beforeImage;
          img.onload = () => {
              setBeforeImage({
                  file: new File([], "restored_before"),
                  base64: item.beforeImage!,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  x: 0, y: 0, scale: 1, rotation: 0
              });
          };
      } else {
          setBeforeImage(null);
      }

      if (item.afterImage) {
          const img = new Image();
          img.src = item.afterImage;
          img.onload = () => {
              setAfterImage({
                  file: new File([], "restored_after"),
                  base64: item.afterImage!,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  x: 0, y: 0, scale: 1, rotation: 0
              });
          };
      } else {
          setAfterImage(null);
      }
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  const setRatio = (r: '1:1'|'4:3'|'9:16'|'16:9') => {
      let w = 1920, h = 1080;
      if (r === '1:1') { w=1080; h=1080; } if (r === '4:3') { w=1440; h=1080; } if (r === '9:16') { w=1080; h=1920; }
      setConfig({...config, aspectRatio: r, width: w, height: h});
  };

  const activeLogo = activeType === 'logo' ? logos.find(l => l.id === activeId) : null;
  const activeEditableImage = activeType === 'before' ? beforeImage : activeType === 'after' ? afterImage : null;
  const activeText = activeType === 'text' ? config.textElements.find(t => t.id === activeId) : null;

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px] text-slate-800 dark:text-slate-100">
        {loading && <LoadingOverlay message={loadingMessage || t.common.processing} t={t} />}

        {/* --- LEFT COLUMN: CONTROL PANEL --- */}
        <div className="w-full xl:w-[280px] flex-shrink-0 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Layers className="text-indigo-500" />
                {t.beforeAfter.panelTitle}
            </h3>

            {/* 1. Layout & Frame Settings */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500">{t.beforeAfter.layoutTitle}</h4>
                
                {/* Size */}
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400">{t.beforeAfter.sizeLabel}</label>
                    <div className="flex gap-1 mb-1">
                        {['1:1', '4:3', '16:9', '9:16'].map(r => (
                            <button key={r} onClick={() => setRatio(r as any)} className={`flex-1 py-1 text-[10px] border rounded ${config.aspectRatio === r ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'border-slate-300 dark:border-slate-700'}`}>{r}</button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input type="number" value={config.width} onChange={e => setConfig({...config, width: parseInt(e.target.value)})} className="w-1/2 p-1.5 text-xs border rounded bg-white dark:bg-slate-800" placeholder={t.beforeAfter.width} />
                        <input type="number" value={config.height} onChange={e => setConfig({...config, height: parseInt(e.target.value)})} className="w-1/2 p-1.5 text-xs border rounded bg-white dark:bg-slate-800" placeholder={t.beforeAfter.height} />
                    </div>
                </div>

                {/* Arrangement */}
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">{t.beforeAfter.arrangementLabel}</label>
                    <select value={config.arrangement} onChange={e => setConfig({...config, arrangement: e.target.value as any})} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800">
                        <option value="left-right">{t.beforeAfter.arrLeftRight}</option>
                        <option value="top-bottom">{t.beforeAfter.arrTopBottom}</option>
                        <option value="diagonal">{t.beforeAfter.arrDiagonal}</option>
                    </select>
                </div>

                {/* Padding/Gap */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-400">{t.beforeAfter.paddingLabel} ({config.padding})</label>
                        <input type="range" min="0" max="100" value={config.padding} onChange={e => setConfig({...config, padding: parseInt(e.target.value)})} className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400">{t.beforeAfter.gapLabel} ({config.gap})</label>
                        <input type="range" min="0" max="50" value={config.gap} onChange={e => setConfig({...config, gap: parseInt(e.target.value)})} className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer" />
                    </div>
                </div>

                {/* Background Color */}
                <div>
                    <label className="text-[10px] text-slate-400">{t.beforeAfter.bgColorLabel}</label>
                    <div className="flex gap-2 items-center">
                        <input 
                            type="color" 
                            value={config.backgroundColor} 
                            onChange={e => setConfig({...config, backgroundColor: e.target.value})} 
                            className="w-8 h-8 p-0 border-0 rounded cursor-pointer" 
                        />
                        <input 
                            type="text" 
                            value={config.backgroundColor} 
                            onChange={e => setConfig({...config, backgroundColor: e.target.value})} 
                            className="flex-1 p-1.5 text-xs border rounded bg-white dark:bg-slate-800 uppercase font-mono"
                        />
                    </div>
                </div>

                {/* Frame Style */}
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">{t.beforeAfter.frameStyleLabel}</label>
                    <select value={config.frameStyle} onChange={handleStyleChange} className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800">
                        {Object.entries(t.beforeAfter.styles).map(([k, v]) => (
                            <option key={k} value={k}>{v as string}</option>
                        ))}
                    </select>
                </div>

                {/* Border Settings */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-slate-400">{t.beforeAfter.borderColorLabel}</label>
                        <div className="flex gap-2">
                            <input type="color" value={config.borderColor} onChange={e => setConfig({...config, borderColor: e.target.value})} className="w-8 h-8 p-0 border-0 rounded" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400">{t.beforeAfter.borderWidthLabel}</label>
                        <input type="number" min="0" max="50" value={config.borderWidth} onChange={e => setConfig({...config, borderWidth: parseInt(e.target.value)})} className="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600" />
                    </div>
                </div>
            </div>

            {/* 2. Text & Logo Controls */}
            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase text-slate-500">{t.beforeAfter.textTitle}</label>
                    <button onClick={addTextElement} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200"><Plus size={12}/> {t.beforeAfter.addText}</button>
                </div>
                
                {/* Editing Panels */}
                {activeType === 'text' && activeText ? (
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-blue-500">Edit Text</span><button onClick={deleteActiveElement} className="text-red-500"><Trash2 size={12}/></button></div>
                        <input type="text" value={activeText.text} onChange={e => updateActiveText('text', e.target.value)} className="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-700" />
                        
                        {/* Font & Size */}
                        <div className="flex gap-2">
                            <select value={activeText.fontFamily} onChange={e => updateActiveText('fontFamily', e.target.value)} className="w-2/3 p-1 text-xs border rounded bg-white dark:bg-slate-700">
                                {FONTS.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
                            </select>
                            <input type="number" value={activeText.fontSize} onChange={e => updateActiveText('fontSize', parseInt(e.target.value))} className="w-1/3 p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600" />
                        </div>

                        {/* Styles & Color */}
                        <div className="flex gap-2 items-center">
                            <input type="color" value={activeText.color} onChange={e => updateActiveText('color', e.target.value)} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                            <button onClick={() => updateActiveText('isBold', !activeText.isBold)} className={`p-1.5 rounded ${activeText.isBold ? 'bg-blue-200 text-blue-800' : 'bg-white text-slate-600'}`}><Bold size={14}/></button>
                            <button onClick={() => updateActiveText('isItalic', !activeText.isItalic)} className={`p-1.5 rounded ${activeText.isItalic ? 'bg-blue-200 text-blue-800' : 'bg-white text-slate-600'}`}><Italic size={14}/></button>
                            
                            {/* Shadow Toggle */}
                            <button 
                                onClick={() => updateActiveText('hasShadow', !activeText.hasShadow)} 
                                className={`p-1.5 rounded ${activeText.hasShadow ? 'bg-blue-200 text-blue-800' : 'bg-white text-slate-600'}`}
                                title={t.beforeAfter.styleShadow}
                            >
                                <span className="font-serif font-bold text-xs" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>S</span>
                            </button>
                        </div>

                        {/* Effects */}
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-400">{t.beforeAfter.effectLabel}</label>
                            <select value={activeText.effect || 'none'} onChange={e => updateActiveText('effect', e.target.value)} className="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-700">
                                {Object.entries(t.beforeAfter.effects).map(([k, v]) => (
                                    <option key={k} value={k}>{v as string}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : activeType === 'logo' && activeLogo ? (
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-purple-500">Edit Logo</span><button onClick={deleteActiveElement} className="text-red-500"><Trash2 size={12}/></button></div>
                        <div className="space-y-1"><div className="flex justify-between text-[10px]"><span>Scale</span><span>{Math.round(activeLogo.scale * 100)}%</span></div><input type="range" min="0.05" max="1" step="0.01" value={activeLogo.scale} onChange={(e) => updateActiveLogo('scale', parseFloat(e.target.value))} className="w-full h-1 bg-slate-300 rounded-lg" /></div>
                        <div className="space-y-1"><div className="flex justify-between text-[10px]"><span>Rotation</span><span>{Math.round(activeLogo.rotation)}°</span></div><input type="range" min="0" max="360" value={activeLogo.rotation} onChange={(e) => updateActiveLogo('rotation', parseInt(e.target.value))} className="w-full h-1 bg-slate-300 rounded-lg" /></div>
                        <div className="space-y-1"><div className="flex justify-between text-[10px]"><span>Opacity</span><span>{activeLogo.opacity}%</span></div><input type="range" min="0" max="1" step="0.01" value={activeLogo.opacity} onChange={(e) => updateActiveLogo('opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-300 rounded-lg" /></div>
                    </div>
                ) : (activeType === 'before' || activeType === 'after') && activeEditableImage ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg space-y-2 animate-in fade-in border border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase">Edit {activeType === 'before' ? 'Before' : 'After'} Image</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]"><span>Scale</span><span>{Math.round(activeEditableImage.scale * 100)}%</span></div>
                            <input type="range" min="0.1" max="3" step="0.1" value={activeEditableImage.scale} onChange={(e) => updateActiveImage('scale', parseFloat(e.target.value))} className="w-full h-1 bg-slate-300 rounded-lg accent-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]"><span>Rotation</span><span>{Math.round(activeEditableImage.rotation)}°</span></div>
                            <input type="range" min="-180" max="180" value={activeEditableImage.rotation} onChange={(e) => updateActiveImage('rotation', parseInt(e.target.value))} className="w-full h-1 bg-slate-300 rounded-lg accent-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]"><span>Pan X / Y</span></div>
                            <div className="flex gap-2">
                                <input type="number" value={Math.round(activeEditableImage.x)} onChange={(e) => updateActiveImage('x', parseInt(e.target.value))} className="w-1/2 p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600" placeholder="X" />
                                <input type="number" value={Math.round(activeEditableImage.y)} onChange={(e) => updateActiveImage('y', parseInt(e.target.value))} className="w-1/2 p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600" placeholder="Y" />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 italic mt-1">Drag image on canvas to move.</p>
                    </div>
                ) : (
                    <div className="text-xs text-slate-400 italic">Click element to edit</div>
                )}
            </div>

            {/* Custom Prompt */}
            <div className="space-y-1 pt-4 border-t border-slate-200 dark:border-slate-700">
                 <label className="text-xs font-bold text-slate-500 uppercase">{t.beforeAfter.promptLabel}</label>
                 <textarea 
                    value={config.customPrompt}
                    onChange={(e) => setConfig({...config, customPrompt: e.target.value})}
                    placeholder={t.beforeAfter.promptPlaceholder}
                    className="w-full p-2 h-16 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 resize-none"
                />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
                <Button 
                    onClick={handleProcess}
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg text-base"
                >
                    {t.beforeAfter.btnStart} <ArrowRight size={18} className="ml-2" />
                </Button>
                <div className="flex gap-2">
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <RefreshCcw size={14} /> {t.beforeAfter.btnReset}
                     </button>
                     <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                        <LogOut size={14} /> {t.beforeAfter.btnExit}
                     </button>
                </div>
            </div>

            {/* History List */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-3">{t.beforeAfter.historyTitle}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-2 group">
                            <img src={item.resultImage} className="w-10 h-10 object-cover rounded border" alt="History" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">Before/After Layout</div>
                                <div className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</div>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => {
                                        setConfig(item.config);
                                        // Restore Images (Simulated)
                                        if(item.beforeImage) {
                                            const img = new Image(); img.src=item.beforeImage; 
                                            img.onload=()=>setBeforeImage({file:new File([],"restored_before"), base64:item.beforeImage!, width:img.naturalWidth, height:img.naturalHeight, x:0, y:0, scale:1, rotation:0});
                                        } else setBeforeImage(null);
                                        if(item.afterImage) {
                                            const img = new Image(); img.src=item.afterImage;
                                            img.onload=()=>setAfterImage({file:new File([],"restored_after"), base64:item.afterImage!, width:img.naturalWidth, height:img.naturalHeight, x:0, y:0, scale:1, rotation:0});
                                        } else setAfterImage(null);
                                    }} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                        <RotateCcw size={10} /> Restore
                                    </button>
                                    <button onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))} className="text-[10px] text-red-600 hover:underline flex items-center gap-1">
                                        <Trash2 size={10} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-xs text-slate-400 italic text-center">Chưa có lịch sử</p>}
                </div>
            </div>
        </div>

        {/* --- CENTER COLUMN: UPLOADS --- */}
        <div className="w-full xl:w-[280px] flex-shrink-0 flex flex-col gap-3">
            <div className="font-bold text-xs text-slate-500 uppercase px-1">{t.beforeAfter.inputArea}</div>
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
                
                {/* 1. Before Image */}
                <div className={`space-y-1 p-2 rounded-lg transition-colors ${activeType === 'before' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''}`}>
                    <label 
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex justify-between"
                        onClick={() => setActiveType('before')}
                    >
                        {t.beforeAfter.uploadBefore}
                        {activeType === 'before' && <MousePointer2 size={12} className="text-blue-500" />}
                    </label>
                    <div className="h-32 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 relative group">
                        {beforeImage ? (
                            <>
                                <img src={beforeImage.base64} className="w-full h-full object-cover" onClick={() => setActiveType('before')} />
                                <button onClick={() => setBeforeImage(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ImageUploader onImageSelect={(f) => handleImageUpload('before', f)} previewUrl={null} t={t} />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. After Image */}
                <div className={`space-y-1 p-2 rounded-lg transition-colors ${activeType === 'after' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''}`}>
                    <label 
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex justify-between"
                        onClick={() => setActiveType('after')}
                    >
                        {t.beforeAfter.uploadAfter}
                        {activeType === 'after' && <MousePointer2 size={12} className="text-blue-500" />}
                    </label>
                    <div className="h-32 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 relative group">
                        {afterImage ? (
                            <>
                                <img src={afterImage.base64} className="w-full h-full object-cover" onClick={() => setActiveType('after')} />
                                <button onClick={() => setAfterImage(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ImageUploader onImageSelect={(f) => handleImageUpload('after', f)} previewUrl={null} t={t} />
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Frame Ref */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.beforeAfter.uploadFrame}</label>
                    <div className="h-20 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 relative group">
                        {frameImage ? (
                            <>
                                <img src={frameImage.base64} className="w-full h-full object-cover" />
                                <button onClick={() => setFrameImage(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                            </>
                        ) : (
                            <label className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                <Upload size={20} className="text-slate-400" />
                                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('frame', e.target.files[0])} />
                            </label>
                        )}
                    </div>
                </div>

                {/* 4. Logos */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.beforeAfter.uploadLogo}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {logos.map(logo => (
                            <div 
                                key={logo.id} 
                                onClick={() => { setActiveId(logo.id); setActiveType('logo'); }}
                                className={`h-16 border rounded-lg overflow-hidden relative group cursor-pointer ${activeType === 'logo' && activeId === logo.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-900'}`}
                            >
                                <img src={logo.base64} className="w-full h-full object-contain p-1" />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setLogos(prev => prev.filter(l => l.id !== logo.id)); if(activeId===logo.id) { setActiveId(null); setActiveType(null); } }} 
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={10}/>
                                </button>
                            </div>
                        ))}
                        <label className="h-16 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <Plus size={20} className="text-slate-400" />
                            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload('logo', e.target.files[0])} />
                        </label>
                    </div>
                </div>

            </div>
        </div>

        {/* --- RIGHT COLUMN: OUTPUT AREA --- */}
        <div className="flex-1 flex flex-col gap-3 min-w-[400px]">
            <div className="flex justify-between items-center px-1">
                <span className="font-bold text-xs text-slate-500 uppercase">{t.beforeAfter.outputArea}</span>
                <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ZoomOut size={14}/></button>
                    <span className="text-xs font-mono w-10 text-center pt-0.5">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => z + 0.1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ZoomIn size={14}/></button>
                </div>
            </div>

            <div className="flex-1 bg-slate-200 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
                
                {/* CANVAS WRAPPER */}
                <div 
                    ref={containerRef}
                    className="flex-1 overflow-auto flex items-center justify-center p-4"
                >
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        style={{ 
                            width: config.width * zoom, 
                            height: config.height * zoom,
                            maxWidth: 'none',
                            maxHeight: 'none' 
                        }}
                        className="shadow-2xl cursor-crosshair bg-white"
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {/* Resolution / Export Settings */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 flex items-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 bg-slate-50 dark:bg-slate-900">
                            <Settings2 size={16} className="text-slate-500 ml-1" />
                            <input 
                                type="number" 
                                value={config.ppi}
                                onChange={(e) => setConfig({...config, ppi: parseInt(e.target.value) || 96})}
                                placeholder="PPI"
                                className="flex-1 bg-transparent border-0 text-xs text-slate-800 dark:text-slate-100 focus:ring-0 p-0"
                                title="Resolution (pixels/inch). Higher values trigger AI Upscale."
                            />
                            <span className="text-[10px] text-slate-400 font-bold pr-1">PPI</span>
                        </div>
                        {config.ppi > 96 && (
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800">
                                <Sparkles size={10} /> AI Upscale Active
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder={t.beforeAfter.refinePlaceholder}
                            className="flex-1 p-2 text-sm border rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-600"
                        />
                        <button onClick={() => {}} className="p-2 bg-slate-700 text-white rounded hover:bg-slate-600"><Send size={16}/></button>
                        <button 
                            onClick={handleDownload}
                            className="px-4 py-2 bg-green-600 text-white font-bold rounded shadow-lg flex items-center gap-2 hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                            <Download size={16} /> {t.beforeAfter.download}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {error && <div className="fixed bottom-4 right-4 bg-red-100 text-red-600 p-4 rounded-xl shadow-lg border border-red-200 z-50 animate-in slide-in-from-bottom-5">{error}</div>}
    </div>
  );
};

export default BeforeAfterTool;
