import React, { useRef } from 'react';
import { ImageFile } from '../types';

interface UploadZoneProps {
  title: string;
  description: string;
  image: ImageFile | null;
  onImageSelected: (image: ImageFile) => void;
  onRemove: () => void;
  id: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
  title, 
  description, 
  image, 
  onImageSelected, 
  onRemove,
  id 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Extract raw base64 for API (remove "data:image/xyz;base64," prefix)
      const base64 = result.split(',')[1];
      
      onImageSelected({
        file,
        previewUrl: result,
        base64,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    if (!image) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-gray-300">{title}</label>
      
      <div 
        onClick={handleClick}
        className={`
          relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 h-64 flex flex-col items-center justify-center
          ${image 
            ? 'border-primary/50 bg-surface' 
            : 'border-gray-600 bg-surface/50 hover:border-primary hover:bg-surface'
          }
        `}
      >
        <input 
          type="file" 
          ref={inputRef}
          id={id}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {image ? (
          <>
            <img 
              src={image.previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium shadow-lg"
              >
                Thay ảnh
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-medium shadow-lg"
              >
                Xóa
              </button>
            </div>
          </>
        ) : (
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-surface border border-gray-600 flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-primary group-hover:border-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-300">{description}</p>
            <p className="text-xs text-gray-500 mt-1">Hỗ trợ PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
    </div>
  );
};