import React, { useRef, useState } from 'react';
import { CardState, TextElement } from '../types';

interface EditorProps {
  cardState: CardState;
  onSelectText: (id: string) => void;
  onUpdateTextPosition: (id: string, x: number, y: number) => void;
  scale?: number;
}

export const Editor: React.FC<EditorProps> = ({ cardState, onSelectText, onUpdateTextPosition, scale = 1 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Handlers for Drag and Drop logic
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingId(id);
    onSelectText(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp values
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    onUpdateTextPosition(draggingId, clampedX, clampedY);
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  return (
    <div 
      className="relative shadow-2xl overflow-hidden transition-all duration-300"
      ref={containerRef}
      style={{
        width: cardState.width,
        height: cardState.height,
        backgroundColor: cardState.backgroundColor,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      // Used for exporting later
      id="card-canvas" 
    >
      {/* Background Layer */}
      {cardState.backgroundImage && (
        <img 
          src={cardState.backgroundImage} 
          alt="bg" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{
            filter: `blur(${cardState.filterBlur}px) brightness(${cardState.filterBrightness}%)`
          }}
        />
      )}

      {/* Text Layer */}
      {cardState.textElements.map(text => (
        <div
          key={text.id}
          onMouseDown={(e) => handleMouseDown(e, text.id)}
          className={`absolute cursor-move select-none p-2 border-2 transition-colors ${
             cardState.selectedElementId === text.id 
             ? 'border-blue-500 bg-blue-500/10' 
             : 'border-transparent hover:border-gray-400/50'
          }`}
          style={{
            left: `${text.x}%`,
            top: `${text.y}%`,
            transform: 'translate(-50%, -50%)',
            fontFamily: text.fontFamily,
            fontSize: `${text.fontSize}px`,
            color: text.color,
            fontWeight: text.fontWeight,
            fontStyle: text.fontStyle,
            textAlign: text.textAlign,
            opacity: text.opacity,
            textShadow: text.shadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
            whiteSpace: 'pre-wrap',
            minWidth: '50px',
            maxWidth: '90%'
          }}
        >
          {text.content}
        </div>
      ))}
    </div>
  );
};