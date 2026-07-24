import React from 'react';
import { TextElement, FontOption } from '../types';
import { FONTS, COLORS } from '../constants';

interface TextControlsProps {
  text: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  onDelete: () => void;
  onDeselect: () => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ text, onUpdate, onDelete, onDeselect }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="font-bold text-gray-200">Edit Text</h3>
        <button onClick={onDeselect} className="text-gray-400 hover:text-white text-sm">Close</button>
      </div>

      {/* Content Input */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Content</label>
        <textarea
          value={text.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          rows={3}
        />
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Font</label>
        <select
          value={text.fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white outline-none"
        >
          {FONTS.map((font) => (
            <option key={font.name} value={font.value} style={{ fontFamily: font.value }}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Size & Opacity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase text-gray-500 mb-1">Size (px)</label>
          <input
            type="number"
            value={text.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-500 mb-1">Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={text.opacity}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
            className="w-full h-10 accent-blue-500"
          />
        </div>
      </div>

      {/* Style Toggles */}
      <div className="flex gap-2">
         <button
          onClick={() => onUpdate({ fontWeight: text.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`flex-1 p-2 rounded border ${text.fontWeight === 'bold' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => onUpdate({ fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`flex-1 p-2 rounded border ${text.fontStyle === 'italic' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
        >
          <em>I</em>
        </button>
        <button
          onClick={() => onUpdate({ shadow: !text.shadow })}
          className={`flex-1 p-2 rounded border ${text.shadow ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
        >
          Shadow
        </button>
      </div>

       {/* Alignment */}
       <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
         {(['left', 'center', 'right'] as const).map(align => (
           <button
            key={align}
            onClick={() => onUpdate({ textAlign: align })}
            className={`flex-1 p-1 rounded capitalize text-sm ${text.textAlign === align ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             {align}
           </button>
         ))}
       </div>

      {/* Colors */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className={`w-6 h-6 rounded-full border-2 ${text.color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input 
            type="color" 
            value={text.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-6 h-6 bg-transparent border-0 p-0 rounded-full overflow-hidden"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700">
        <button
          onClick={onDelete}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded transition-colors"
        >
          Delete Text
        </button>
      </div>
    </div>
  );
};