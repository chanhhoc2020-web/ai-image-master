import React from 'react';
import { Upload, X } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  previewUrl: string | null;
  onImageSelect: (file: File) => void;
  onClear: () => void;
  id: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, previewUrl, onImageSelect, onClear, id }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium text-gray-300 uppercase tracking-wider">{label}</span>
      <div 
        className={`
          relative flex items-center justify-center w-full h-48 sm:h-64 
          border-2 border-dashed rounded-xl transition-all duration-300 overflow-hidden group
          ${previewUrl ? 'border-transparent' : 'border-gray-600 bg-gray-800 hover:bg-gray-750 hover:border-gray-500'}
        `}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button 
                onClick={onClear}
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transform scale-90 hover:scale-100 transition-transform"
                title="Remove Image"
              >
                <X size={20} />
              </button>
            </div>
          </>
        ) : (
          <label htmlFor={id} className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
            <Upload className="w-8 h-8 text-gray-400 mb-2 group-hover:text-white transition-colors" />
            <p className="text-sm text-gray-400 group-hover:text-gray-200 text-center px-4">
              Click to upload {label}
            </p>
            <input 
              id={id} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;