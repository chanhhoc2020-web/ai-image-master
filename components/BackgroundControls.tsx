import React, { useState } from 'react';
import { CardState } from '../types';
import { DEFAULT_BACKGROUNDS, CARD_SIZES } from '../constants';
import { generateBackgroundImage } from '../services/geminiService';

interface BackgroundControlsProps {
  cardState: CardState;
  onUpdate: (updates: Partial<CardState>) => void;
}

export const BackgroundControls: React.FC<BackgroundControlsProps> = ({ cardState, onUpdate }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    const image = await generateBackgroundImage(prompt);
    if (image) {
      onUpdate({ backgroundImage: image });
    }
    setIsGenerating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdate({ backgroundImage: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="font-bold text-gray-200 border-b border-gray-700 pb-2">Canvas Settings</h3>

      {/* Resize */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Size</label>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white outline-none"
          onChange={(e) => {
             const size = CARD_SIZES.find(s => s.name === e.target.value);
             if(size) onUpdate({ width: size.width, height: size.height });
          }}
          value={CARD_SIZES.find(s => s.width === cardState.width && s.height === cardState.height)?.name || ''}
        >
          {CARD_SIZES.map(s => (
            <option key={s.name} value={s.name}>{s.name} ({s.width}x{s.height})</option>
          ))}
        </select>
      </div>

      {/* Color BG */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Background Color</label>
        <div className="flex items-center gap-2">
           <input
            type="color"
            value={cardState.backgroundColor}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value, backgroundImage: null })}
            className="h-8 w-12 bg-transparent border-0 p-0 rounded cursor-pointer"
          />
          <span className="text-gray-400 text-sm">{cardState.backgroundColor}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 border-t border-gray-700 pt-4">
        <label className="block text-xs uppercase text-gray-500">Image Filters</label>
        <div>
          <span className="text-xs text-gray-400">Blur</span>
          <input
            type="range"
            min="0"
            max="10"
            value={cardState.filterBlur}
            onChange={(e) => onUpdate({ filterBlur: Number(e.target.value) })}
            className="w-full h-1 accent-blue-500"
          />
        </div>
        <div>
          <span className="text-xs text-gray-400">Brightness</span>
          <input
            type="range"
            min="50"
            max="150"
            value={cardState.filterBrightness}
            onChange={(e) => onUpdate({ filterBrightness: Number(e.target.value) })}
            className="w-full h-1 accent-blue-500"
          />
        </div>
      </div>

      {/* AI Gen */}
      <div className="border-t border-gray-700 pt-4">
        <label className="block text-xs uppercase text-blue-400 mb-2 font-bold">AI Background Generator</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your theme (e.g., watercolor flowers, gold sparkles on black)..."
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm mb-2"
          rows={2}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full py-2 rounded text-white font-medium ${isGenerating ? 'bg-blue-800 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90'}`}
        >
          {isGenerating ? 'Dreaming...' : 'Generate Image'}
        </button>
      </div>

       {/* Upload */}
       <div className="border-t border-gray-700 pt-4">
        <label className="block text-xs uppercase text-gray-500 mb-2">Upload Image</label>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-gray-700 file:text-white
            hover:file:bg-gray-600
          "
        />
      </div>

      {/* Presets */}
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-2">Presets</label>
        <div className="grid grid-cols-3 gap-2">
          {DEFAULT_BACKGROUNDS.map((url, i) => (
            <button
              key={i}
              onClick={() => onUpdate({ backgroundImage: url, filterBlur: 0, filterBrightness: 100 })}
              className="w-full h-16 rounded overflow-hidden border border-gray-700 hover:border-white"
            >
              <img src={url} alt="preset" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};