import React from 'react';
import { GeneratedImage } from '../types';

interface ResultGridProps {
  images: GeneratedImage[];
}

export const ResultGrid: React.FC<ResultGridProps> = ({ images }) => {
  if (images.length === 0) return null;

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    images.forEach((img, index) => {
      // Stagger downloads slightly to prevent browser blocking
      setTimeout(() => {
        downloadImage(img.url, `logo-design-${index + 1}.png`);
      }, index * 300);
    });
  };

  return (
    <div className="mt-8 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Kết Quả Thiết Kế ({images.length})</h2>
        <button
          onClick={downloadAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-900/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0L16.5 12M12 16.5V3" />
          </svg>
          Tải Về Tất Cả
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {images.map((img, index) => (
          <div key={img.id} className="group relative aspect-square bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700">
            <img
              src={img.url}
              alt={`Logo generated ${index + 1}`}
              className="w-full h-full object-contain p-4 bg-white" 
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
              <span className="text-white font-semibold tracking-wide">Mẫu {index + 1}</span>
              <button
                onClick={() => downloadImage(img.url, `logo-design-${index + 1}.png`)}
                className="px-4 py-2 bg-white text-gray-900 rounded-full font-bold hover:bg-brand-400 hover:text-white transition-colors transform hover:scale-105"
              >
                Tải về PNG
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};