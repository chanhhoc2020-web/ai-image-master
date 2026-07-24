/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Editor } from './components/Editor';
import { editImage } from './services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Sparkles } from 'lucide-react';

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (base64: string) => {
    setOriginalImage(base64);
    setProcessedImage(null);
    setError(null);
  };

  const handleProcess = async (prompt: string) => {
    if (!originalImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await editImage({
        image: originalImage,
        prompt: prompt
      });
      setProcessedImage(result);
    } catch (err) {
      console.error(err);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PortraitAI</h1>
              <p className="text-xs text-white/40 font-medium tracking-wide uppercase">Intelligent Retouching</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Powered by Gemini 2.5 Flash</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {!originalImage ? (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex items-center justify-center"
              >
                <div className="w-full">
                  <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 tracking-tight">
                      Transform your portraits<br />with AI precision.
                    </h2>
                    <p className="text-lg text-white/40 max-w-2xl mx-auto">
                      Professional retouching, lighting adjustments, and style transfers in seconds.
                    </p>
                  </div>
                  <ImageUploader onImageSelect={handleImageSelect} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Editor 
                  originalImage={originalImage}
                  processedImage={processedImage}
                  isProcessing={isProcessing}
                  onProcess={handleProcess}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        
        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500/90 backdrop-blur text-white rounded-full shadow-xl z-50 flex items-center gap-2"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-2 hover:bg-white/20 rounded-full p-1">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

