import { ToolType } from "../types";

export async function processImage(
  tool: ToolType,
  base64Image: string | null,
  mimeType: string | null,
  prompt: string,
  config?: any,
  referenceImage?: string | string[]
): Promise<string> {
  const isTextToImage = tool === ToolType.TEXT_TO_IMAGE || !base64Image;

  try {
    if (isTextToImage) {
      const response = await fetch('/api/huggingface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'text-to-image',
          payload: { inputs: prompt || 'A beautiful high quality image' }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Vercel API Error: ${err}`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const response = await fetch('/api/huggingface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'image-to-image',
          payload: { base64: base64Image, mimeType: mimeType }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Vercel API Error: ${err}`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (error: any) {
    console.error("API Proxy Error:", error);
    throw error;
  }
}

export async function generateBackgroundImage(prompt: string): Promise<string> {
  return processImage(ToolType.TEXT_TO_IMAGE, null, null, `Generate a beautiful background: ${prompt}`);
}

export async function generateWishes(occasion: string, tone: string): Promise<string[]> {
  const prompt = `Write 5 short wishes for ${occasion} in ${tone} tone. Return ONLY 5 sentences separated by |.`;
  
  try {
    const response = await fetch('/api/huggingface', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'text-generation',
        payload: { inputs: `[INST] ${prompt} [/INST]` }
      })
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
  return "Phân tích ảnh tự động không khả dụng với Serverless Free API. Vui lòng tự nhập mô tả phong cách.";
}