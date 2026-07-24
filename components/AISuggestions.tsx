import React, { useState } from 'react';
import { generateWishes } from '../services/geminiService';

interface AISuggestionsProps {
  onSelect: (text: string) => void;
}

export const AISuggestions: React.FC<AISuggestionsProps> = ({ onSelect }) => {
  const [occasion, setOccasion] = useState('Birthday');
  const [tone, setTone] = useState('Funny');
  const [wishes, setWishes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const results = await generateWishes(occasion, tone);
    setWishes(results);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-200 border-b border-gray-700 pb-2">AI Text Writer</h3>
      
      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Occasion</label>
        <input
          type="text"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
        />
      </div>

      <div>
        <label className="block text-xs uppercase text-gray-500 mb-1">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
        >
          <option>Heartfelt</option>
          <option>Funny</option>
          <option>Professional</option>
          <option>Poetic</option>
          <option>Short & Sweet</option>
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors disabled:opacity-50"
      >
        {loading ? 'Writing Magic...' : 'Generate Wishes'}
      </button>

      <div className="space-y-2 mt-4">
        {wishes.map((wish, idx) => (
          <div 
            key={idx} 
            onClick={() => onSelect(wish)}
            className="p-3 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 cursor-pointer text-sm text-gray-200 transition-colors"
          >
            "{wish}"
          </div>
        ))}
      </div>
    </div>
  );
};