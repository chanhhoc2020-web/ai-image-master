import React from 'react';
import { motion } from 'motion/react';
import { Download, RefreshCw, Sparkles, Wand2, User, Palette, Zap } from 'lucide-react';

interface EditorProps {
  originalImage: string;
  processedImage: string | null;
  isProcessing: boolean;
  onProcess: (prompt: string) => void;
  onReset: () => void;
}

const PRESET_ACTIONS = [
  {
    id: 'retouch',
    label: 'Pro Retouch',
    icon: Sparkles,
    prompt: 'Professional skin retouching, remove blemishes, smooth skin texture while keeping it natural, improve lighting for a studio look.',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
  },
  {
    id: 'lighting',
    label: 'Studio Lighting',
    icon: Zap,
    prompt: 'Enhance lighting to look like professional studio photography, dramatic rim lighting, soft fill light, high contrast and clarity.',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
  },
  {
    id: 'background',
    label: 'Clean Background',
    icon: User,
    prompt: 'Change the background to a clean, professional solid color gradient or blurred office background, keep the subject perfectly isolated.',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
  },
  {
    id: 'creative',
    label: 'Cyberpunk Style',
    icon: Palette,
    prompt: 'Apply a cyberpunk aesthetic, neon lighting, pink and blue hues, futuristic vibe.',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
  }
];

export function Editor({ originalImage, processedImage, isProcessing, onProcess, onReset }: EditorProps) {
  const [customPrompt, setCustomPrompt] = React.useState('');

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'portrait-ai-edit.png';
    link.click();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      {/* Sidebar Controls */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-80 flex flex-col gap-6 shrink-0 overflow-y-auto pr-2"
      >
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            {PRESET_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => onProcess(action.prompt)}
                disabled={isProcessing}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left group ${action.color} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <action.icon className="w-5 h-5" />
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Custom Edit</h3>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe how you want to change the image..."
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-white/30 text-sm resize-none h-24 p-0"
            />
            <div className="flex justify-end mt-2 pt-2 border-t border-white/10">
              <button
                onClick={() => onProcess(customPrompt)}
                disabled={!customPrompt.trim() || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors font-medium"
              >
                <Wand2 className="w-4 h-4" />
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Start Over
          </button>
        </div>
      </motion.div>

      {/* Main Canvas */}
      <div className="flex-1 bg-black/40 rounded-3xl border border-white/10 overflow-hidden relative flex items-center justify-center p-8 backdrop-blur-sm">
        <div className="relative w-full h-full flex items-center justify-center">
          {isProcessing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white font-medium animate-pulse">Enhancing your portrait...</p>
            </div>
          )}
          
          <div className="relative max-w-full max-h-full flex gap-4">
             {/* Comparison View if processed exists, otherwise just original */}
             {processedImage ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
                 <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/20">
                    <img 
                      src={originalImage} 
                      alt="Original" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-white/80">Original</div>
                 </div>
                 <div className="relative group rounded-xl overflow-hidden border border-indigo-500/30 bg-black/20 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                    <img 
                      src={processedImage} 
                      alt="Processed" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 bg-indigo-500/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-white">AI Edited</div>
                    <button 
                      onClick={handleDownload}
                      className="absolute bottom-4 right-4 p-3 bg-white text-black rounded-full shadow-lg hover:scale-110 transition-transform"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                 </div>
               </div>
             ) : (
               <img 
                 src={originalImage} 
                 alt="Original" 
                 className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
               />
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
