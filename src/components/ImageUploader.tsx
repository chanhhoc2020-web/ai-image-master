import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { resizeImage } from '../utils';

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
}

export function ImageUploader({ onImageSelect }: ImageUploaderProps) {
  const processFile = useCallback(async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Resize image to max 1024x1024 to ensure fast processing and avoid payload limits
        const resized = await resizeImage(base64, 1024, 1024);
        onImageSelect(resized);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className="w-full max-w-xl mx-auto">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-indigo-500/50 transition-colors bg-black/20 backdrop-blur-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">Upload a Portrait</h3>
        <p className="text-white/40 mb-8">Drag and drop or click to select</p>
        
        <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer transition-colors font-medium">
          <ImageIcon className="w-4 h-4" />
          <span>Select Photo</span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>
      </motion.div>
    </div>
  );
}
