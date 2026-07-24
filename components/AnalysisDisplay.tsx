import React from 'react';
import { AnalysisResult } from '../types';
import { PaletteIcon, CameraIcon, SparklesIcon } from './Icons';

interface AnalysisDisplayProps {
  data: AnalysisResult;
}

const Card = ({ title, children, icon: Icon, delay }: { title: string, children?: React.ReactNode, icon?: React.ElementType, delay: number }) => (
  <div 
    className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-6 hover:border-indigo-500/50 transition-all duration-500 opacity-0 animate-fade-in-up"
    style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
  >
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon />}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    <div className="text-slate-300 leading-relaxed">
      {children}
    </div>
  </div>
);

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ data }) => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* 1. Artistic Style - Full Width */}
      <div className="md:col-span-2">
        <Card title="Phong Cách Nghệ Thuật" icon={SparklesIcon} delay={100}>
          <p className="text-xl text-white font-medium">{data.artisticStyle}</p>
        </Card>
      </div>

      {/* 2. Color Palette */}
      <Card title="Bảng Màu" icon={PaletteIcon} delay={200}>
        <div className="flex gap-3 mt-2 flex-wrap">
          {data.colorPalette.map((color, idx) => (
            <div key={idx} className="group flex flex-col items-center gap-1">
              <div 
                className="w-12 h-12 rounded-full shadow-lg ring-2 ring-slate-700 group-hover:scale-110 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                title={color}
              />
              <span className="text-xs font-mono text-slate-500 uppercase">{color}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Mood */}
      <Card title="Cảm Xúc & Không Khí" delay={300} icon={() => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" /></svg>}>
        {data.mood}
      </Card>

      {/* 4. Composition */}
      <Card title="Bố Cục" delay={400} icon={() => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" /></svg>}>
        {data.composition}
      </Card>

      {/* 5. Technical Details */}
      <Card title="Chi Tiết Kỹ Thuật" icon={CameraIcon} delay={500}>
        {data.technicalDetails}
      </Card>

      {/* 6. Keywords - Full Width */}
      <div className="md:col-span-2">
         <Card title="Từ Khóa" delay={600} icon={() => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>}>
          <div className="flex flex-wrap gap-2">
            {data.keywords.map((keyword, idx) => (
              <span key={idx} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm border border-indigo-500/30">
                #{keyword}
              </span>
            ))}
          </div>
        </Card>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation-name: fadeInUp;
          animation-duration: 0.6s;
        }
      `}</style>
    </div>
  );
};