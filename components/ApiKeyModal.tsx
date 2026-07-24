
import React, { useState } from 'react';
import { Button } from './Button';
import { Key, Lock, AlertCircle, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave }) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError('Vui lòng nhập API Key.');
      return;
    }
    if (!inputKey.startsWith('hf_')) {
      setError('Token có vẻ không hợp lệ (thường bắt đầu bằng hf_...).');
      // We warn but don't block in case of format changes, unless strictly required
    }
    onSave(inputKey.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
            <Key className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Yêu cầu Access Token</h2>
          <p className="text-blue-100 text-sm">Kết nối với Hugging Face AI (Miễn phí)</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="flex gap-2">
              <Lock className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <span>
                Ứng dụng này yêu cầu <strong>Hugging Face Access Token</strong> riêng của bạn để xử lý ảnh. Token được lưu an toàn trên trình duyệt của bạn.
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Nhập Access Token của bạn
              </label>
              <input
                type="password"
                id="apiKey"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setError('');
                }}
                placeholder="hf_..."
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all outline-none"
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs mt-2 animate-in slide-in-from-top-1">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full py-3 text-base shadow-lg shadow-blue-500/25">
              Kết nối & Bắt đầu
            </Button>
          </form>

          <div className="text-center pt-2">
            <a 
              href="https://huggingface.co/settings/tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Chưa có Token? Lấy miễn phí tại Hugging Face <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
