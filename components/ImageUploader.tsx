
import React, { useRef } from 'react';

interface ImageUploaderProps {
  onImageSelect: (file: File, base64: string) => void;
  previewUrl: string | null;
  t?: any;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, previewUrl, t }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Default to Vietnamese if t is not provided (defensive coding)
  const txt = t?.common || {
    uploadTitle: "Tải ảnh lên",
    changeImage: "Thay đổi ảnh",
    dragDrop: "Click để chọn ảnh hoặc kéo thả",
    formats: "Hỗ trợ JPG, PNG, WEBP"
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(file, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{txt.uploadTitle}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all 
            ${previewUrl 
                ? 'border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/20' 
                : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-slate-800'
            }
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*"
        />
        
        {previewUrl ? (
          <div className="relative aspect-video max-h-64 mx-auto overflow-hidden rounded-lg">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white font-medium bg-black/50 px-3 py-1 rounded-full text-sm">{txt.changeImage}</span>
            </div>
          </div>
        ) : (
          <div className="py-8">
            <svg className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-slate-600 dark:text-slate-300 font-medium">{txt.dragDrop}</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">{txt.formats}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
