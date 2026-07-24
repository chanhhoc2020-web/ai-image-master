import React, { useState, useEffect, useRef } from 'react';
import { ImageState, DesignSuggestion, ViewMode } from '../types';
import { ArrowLeftRight } from 'lucide-react';

interface ComparisonFrameProps {
  before: ImageState;
  after: ImageState;
  design: DesignSuggestion;
  viewMode: ViewMode;
}

const ComparisonFrame: React.FC<ComparisonFrameProps> = ({ before, after, design, viewMode }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Determine font class
  const getFontClass = () => {
    switch (design.fontStyle) {
      case 'classic': return 'font-serif tracking-tight';
      case 'fun': return 'font-comic tracking-wide uppercase';
      default: return 'font-sans tracking-tight';
    }
  };

  const handleDrag = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    // Calculate percentage relative to image container only, not the padding
    // We assume the slider is inside a specific container width
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) handleDrag(e);
    };
    
    const handleGlobalUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('touchmove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging]);

  const imagesReady = before.previewUrl && after.previewUrl;

  if (!imagesReady) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
        <p>Add both images to see the preview</p>
      </div>
    );
  }

  // Styles based on AI suggestion
  const containerStyle = {
    backgroundColor: design.backgroundColor,
    borderColor: design.frameColor,
  };

  const textStyle = {
    color: design.textColor,
  };

  const accentStyle = {
    backgroundColor: design.accentColor,
    color: design.backgroundColor, // Contrast text for badges
  };

  return (
    <div 
      id="export-container"
      className="relative overflow-hidden transition-all duration-500 shadow-2xl mx-auto"
      style={{
        ...containerStyle,
        width: '100%',
        maxWidth: '800px',
        padding: '2rem', // The "Frame" thickness
      }}
    >
      {/* Header / Title Section */}
      <div className="text-center mb-6 relative z-10">
        <div className="inline-block px-4 py-1 rounded-full mb-3 text-sm font-bold shadow-sm" style={accentStyle}>
          {design.marketingHook} {design.emoji}
        </div>
        <h1 className={`text-3xl md:text-5xl font-bold mb-2 ${getFontClass()}`} style={textStyle}>
          {design.title}
        </h1>
        <p className="text-lg opacity-80" style={textStyle}>{design.subtitle}</p>
      </div>

      {/* Image Content Area */}
      <div 
        className={`
          relative w-full rounded-lg overflow-hidden shadow-inner border-4
          ${viewMode === 'side-by-side' ? 'grid grid-cols-2 gap-1' : ''}
          ${viewMode === 'stacked' ? 'grid grid-rows-2 gap-1' : ''}
        `}
        style={{ borderColor: design.frameColor, height: viewMode === 'stacked' ? '800px' : '400px' }}
      >
        {/* SLIDER VIEW */}
        {viewMode === 'slider' && (
           <div 
             ref={containerRef}
             className="relative w-full h-full cursor-col-resize select-none touch-none group"
             onMouseDown={handleMouseDown}
             onTouchStart={handleMouseDown}
             onClick={(e) => handleDrag(e)}
           >
             {/* After Image (Background) */}
             <img 
               src={after.previewUrl!} 
               alt="After" 
               className="absolute inset-0 w-full h-full object-cover" 
               draggable={false}
             />
             <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
               AFTER
             </div>

             {/* Before Image (Foreground - Clipped) */}
             <div 
               className="absolute inset-0 w-full h-full overflow-hidden"
               style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
             >
               <img 
                 src={before.previewUrl!} 
                 alt="Before" 
                 className="absolute inset-0 w-full h-full object-cover max-w-none" 
                 // Ensure width is fixed to container width so it doesn't squish
                 style={{ width: '100%' }}
                 draggable={false}
               />
               <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
                 BEFORE
               </div>
             </div>

             {/* Slider Handle */}
             <div 
               className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
               style={{ left: `${sliderPosition}%` }}
             >
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center transform transition-transform group-hover:scale-110"
                  style={{ color: design.accentColor }}
                >
                  <ArrowLeftRight size={20} />
                </div>
             </div>
           </div>
        )}

        {/* SIDE BY SIDE VIEW */}
        {viewMode === 'side-by-side' && (
          <>
            <div className="relative h-full w-full">
              <img src={before.previewUrl!} className="w-full h-full object-cover" alt="Before" />
              <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
                BEFORE
              </div>
            </div>
            <div className="relative h-full w-full">
              <img src={after.previewUrl!} className="w-full h-full object-cover" alt="After" />
              <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
                AFTER
              </div>
            </div>
          </>
        )}

        {/* STACKED VIEW */}
        {viewMode === 'stacked' && (
          <>
             <div className="relative h-full w-full">
              <img src={before.previewUrl!} className="w-full h-full object-cover" alt="Before" />
              <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
                BEFORE
              </div>
            </div>
            <div className="relative h-full w-full">
              <img src={after.previewUrl!} className="w-full h-full object-cover" alt="After" />
              <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-bold backdrop-blur-sm">
                AFTER
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer / Decorative Elements */}
      <div className="mt-6 flex justify-between items-center relative z-10">
        <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: design.accentColor }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: design.textColor, opacity: 0.5 }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: design.frameColor, opacity: 0.5 }}></div>
        </div>
        <div className={`text-sm opacity-60 italic ${getFontClass()}`} style={textStyle}>
          Generated by AI Studio
        </div>
      </div>
    </div>
  );
};

export default ComparisonFrame;