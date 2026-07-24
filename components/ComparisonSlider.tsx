import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scaling } from 'lucide-react';

interface ComparisonSliderProps {
  originalImage: string;
  processedImage: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ originalImage, processedImage }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => setIsResizing(true), []);
  const handleMouseUp = useCallback(() => setIsResizing(false), []);

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      handleMove(e.clientX);
    }
  }, [isResizing, handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isResizing) {
      handleMove(e.touches[0].clientX);
    }
  }, [isResizing, handleMove]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-800 select-none group"
    >
      {/* Background Image (After / Processed) */}
      <img 
        src={processedImage} 
        alt="Processed" 
        className="absolute top-0 left-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* Foreground Image (Before / Original) - Clipped */}
      <div 
        className="absolute top-0 left-0 w-full h-full overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img 
          src={originalImage} 
          alt="Original" 
          className="absolute top-0 left-0 max-w-none h-full object-contain"
          // We need to calculate width to match the container's full width even when clipped
          style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%' }}
          draggable={false}
        />
        
        {/* Label Badge */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded font-bold border border-white/10">
          Gốc
        </div>
      </div>

       {/* Label Badge for After */}
       <div className="absolute top-4 right-4 bg-blue-600/60 backdrop-blur text-white text-xs px-2 py-1 rounded font-bold border border-white/10">
          Kết quả AI
        </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${sliderPosition}%` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900 hover:scale-110 transition-transform">
           <Scaling size={16} />
        </div>
      </div>
    </div>
  );
};