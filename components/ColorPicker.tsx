import React, { useRef } from 'react';

interface ColorPickerProps {
  selectedColors: string[];
  onChange: (colors: string[]) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColors, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    if (!selectedColors.includes(newColor)) {
      onChange([...selectedColors, newColor]);
    }
  };

  const removeColor = (colorToRemove: string) => {
    onChange(selectedColors.filter(c => c !== colorToRemove));
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {selectedColors.map((color) => (
        <div key={color} className="relative group">
          <div
            className="w-10 h-10 rounded-full border-2 border-white/20 shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          />
          <button
            onClick={() => removeColor(color)}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            title="Xóa màu"
          >
            ×
          </button>
        </div>
      ))}
      
      <button
        onClick={triggerInput}
        className="w-10 h-10 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center text-gray-400 hover:text-white hover:border-white transition-colors"
        title="Thêm màu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="color"
        className="invisible absolute w-0 h-0"
        onChange={handleAddColor}
      />
    </div>
  );
};