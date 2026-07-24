import { ToolType } from "../types";

const getHfKey = () => {
  const apiKey = localStorage.getItem('hf_api_key') || '';
  if (!apiKey) {
    throw new Error('Hugging Face Token is thiếu. Vui lòng kết nối Token trong cài đặt.');
  }
  return apiKey;
};

const getBase64Details = (base64String: string, mimeType: string | null) => {
  if (base64String.includes('base64,')) {
      const arr = base64String.split(',');
      return {
          data: arr[1],
          mimeType: arr[0].match(/:(.*?);/)?.[1] || mimeType || 'image/png'
      };
  }
  return { data: base64String, mimeType: mimeType || 'image/png' };
};

export async function processImage(
  tool: ToolType,
  base64Image: string | null,
  mimeType: string | null,
  prompt: string,
  config?: any,
  referenceImage?: string | string[]
): Promise<string> {
  const apiKey = getHfKey();
  
  const isTextToImage = tool === ToolType.TEXT_TO_IMAGE || !base64Image;
  const MODEL_URL = isTextToImage 
      ? 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0'
      : 'https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix';
  
  let body: any;
  let headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
  };

  if (isTextToImage) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ inputs: prompt || 'A beautiful high quality image' });
  } else {
      // For image-to-image with HF free inference API
      // Note: instruct-pix2pix on free tier might fail or have long cold starts
      const details = getBase64Details(base64Image!, mimeType);
      
      // Convert base64 to binary blob
      const byteString = atob(details.data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
      }
      body = new Blob([ab], { type: details.mimeType });
      headers['Content-Type'] = details.mimeType;
      // We pass the prompt via a custom header or if HF doesn't support it well, 
      // the free API might ignore the prompt and just run a generic pass.
      // Removed X-Wait-For-Model to avoid CORS preflight errors in browser
  }

  try {
      const response = await fetch(MODEL_URL, {
          method: 'POST',
          headers,
          body,
      });

      if (!response.ok) {
          const err = await response.text();
          console.error("HF Error:", err);
          throw new Error(`Hugging Face API đang quá tải hoặc Model đang ngủ. Vui lòng thử lại sau 30s. (${response.status})`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  } catch (error: any) {
      console.error("Hugging Face API Error:", error);
      throw error;
  }
}

export async function generateBackgroundImage(prompt: string): Promise<string> {
    return processImage(ToolType.TEXT_TO_IMAGE, null, null, `Generate a beautiful background: ${prompt}`);
}

export async function generateWishes(occasion: string, tone: string): Promise<string[]> {
    const apiKey = getHfKey();
    const prompt = `Write 5 short wishes for ${occasion} in ${tone} tone. Return ONLY 5 sentences separated by |.`;
    
    try {
        const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: `[INST] ${prompt} [/INST]` })
        });
        
        if (!response.ok) return ["Chúc bạn vui vẻ!"];
        const data = await response.json();
        const text = data[0]?.generated_text || "";
        return text.replace(`[INST] ${prompt} [/INST]`, '').split('|').filter((s: string) => s.trim().length > 0);
    } catch {
        return ["Chúc bạn một ngày tuyệt vời!", "Luôn vui vẻ nhé!"];
    }
}

export async function analyzeImageStyle(base64: string, mimeType: string, lang: string): Promise<string> {
    return "Phân tích ảnh tự động không khả dụng với Hugging Face Free API. Vui lòng tự nhập mô tả phong cách.";
}