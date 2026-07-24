import React from 'react';

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="prompt" className="text-sm font-semibold text-gray-300">
        Mô tả yêu cầu (Tùy chọn)
      </label>
      <div className="relative">
        <textarea
          id="prompt"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Ví dụ: Đặt nhãn vào chính giữa chai, hơi xoay nhẹ sang trái, ánh sáng tự nhiên..."
          className="w-full h-24 bg-surface border border-gray-600 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all disabled:opacity-50"
        />
        <div className="absolute bottom-3 right-3 text-xs text-gray-500">
          AI Suggestion
        </div>
      </div>
    </div>
  );
};