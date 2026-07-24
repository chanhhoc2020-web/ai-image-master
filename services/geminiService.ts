import { GoogleGenAI } from "@google/genai";
import { ToolType } from "../types";

const IMAGE_MODEL_ID = 'gemini-1.5-flash';
const TEXT_MODEL_ID = 'gemini-1.5-flash';

const getGenAI = () => {
  const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) {
    throw new Error('API Key is missing. Please set it in settings.');
  }
  return new GoogleGenAI({ apiKey });
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
  const genAI = getGenAI();
  const parts: any[] = [];

  // Add Main Image
  if (base64Image) {
      const details = getBase64Details(base64Image, mimeType);
      parts.push({
          inlineData: {
              data: details.data,
              mimeType: details.mimeType
          }
      });
  }

  // Add Reference Images
  const addImagePart = (b64: string) => {
      const details = getBase64Details(b64, null);
      parts.push({
          inlineData: {
              data: details.data,
              mimeType: details.mimeType
          }
      });
  };

  if (referenceImage) {
      if (Array.isArray(referenceImage)) {
          referenceImage.forEach(img => addImagePart(img));
      } else {
          addImagePart(referenceImage);
      }
  }

  // Construct Prompt based on Tool
  let finalPrompt = "";

  if (tool === ToolType.COMPONENT_GENERATION) {
      const cgConfig = config as import("../types").ComponentGenerationConfig;
      
      finalPrompt = `
      Task: Create a cohesive image composition.
      
      Specifications:
      - Size: ${cgConfig.width}x${cgConfig.height}px
      - Aspect Ratio: ${cgConfig.aspectRatio}
      - Resolution: ${cgConfig.ppi} PPI
      - Style: ${cgConfig.style}
      
      Enhancements:
      ${cgConfig.enhancements.lightBalance ? 'Light Balance: Yes.' : ''}
      ${cgConfig.enhancements.denoise ? 'Denoise: Yes.' : ''}
      ${cgConfig.enhancements.hdr ? 'HDR: Yes.' : ''}
      ${cgConfig.enhancements.sharpen ? 'Sharpen: Yes.' : ''}
      
      User Description: "${prompt || cgConfig.customPrompt || "Combine provided components naturally."}"
      
      Action: Use the provided component images to generate the result. Return ONLY the image.
      `;
  } 
  else if (tool === ToolType.RECOLOR) {
      finalPrompt = `Task: Object Recolor. ${prompt}`;
  } 
  else if (tool === ToolType.REMOVE_BG) {
      finalPrompt = `Task: Remove Background. ${prompt}`;
  } 
  else if (tool === ToolType.ID_PHOTO) {
      finalPrompt = `Task: Generate Professional ID Photo. ${prompt}`;
  } 
  else if (tool === ToolType.TEXT_TO_IMAGE) {
      finalPrompt = `Generate Image: ${prompt}`;
  } 
  else if (tool === ToolType.CHANGE_ACCESSORY) {
      finalPrompt = `Task: Add/Change Accessory. ${prompt}`;
  }
  else if (tool === ToolType.RESTORATION) {
      finalPrompt = `Task: Restore Photo. ${prompt}`;
  }
  else if (tool === ToolType.OBJECT_EDITING) {
      finalPrompt = `Task: Object Editing (Add/Remove/Replace). ${prompt}`;
  }
  else if (tool === ToolType.VECTOR_CONVERSION) {
      finalPrompt = `Task: Convert to Vector Style. ${prompt}`;
  }
  else if (tool === ToolType.ADVANCED_RECOLOR) {
      finalPrompt = `Task: Advanced Recolor. ${prompt}`;
  }
  else if (tool === ToolType.MARKETING_DESIGN) {
      finalPrompt = `Task: Marketing Design. ${prompt}`;
  }
  else if (tool === ToolType.PORTRAIT_EDITING) {
      finalPrompt = `Task: Portrait Editing. ${prompt}`;
  }
  else if (tool === ToolType.LOGO_DESIGN) {
      finalPrompt = `Task: Logo Design. ${prompt}`;
  }
  else if (tool === ToolType.THUMBNAIL_DESIGN) {
      finalPrompt = `Task: Thumbnail Design. ${prompt}`;
  }
  else if (tool === ToolType.PRODUCT_LABEL) {
      finalPrompt = `Task: Product Label Application. ${prompt}`;
  }
  else if (tool === ToolType.INVITATION_DESIGN) {
      finalPrompt = `Task: Invitation Design. ${prompt}`;
  }
  else if (tool === ToolType.IMAGE_RESIZER) {
      finalPrompt = `Task: Upscale/Resize Image. ${prompt}`;
  }
  else if (tool === ToolType.BEFORE_AFTER) {
      finalPrompt = `Task: Create Before/After Layout. ${prompt}`;
  }
  else {
      finalPrompt = `Task: ${tool}. Instructions: ${prompt}`;
  }

  // Strict instruction to prevent chatty responses
  finalPrompt += " Output: Generated Image only.";

  parts.push({ text: finalPrompt });

  try {
    const response = await genAI.models.generateContent({
      model: IMAGE_MODEL_ID,
      contents: { parts: parts },
      // Removed temperature config to rely on model defaults for image generation consistency
    });

    const candidates = response.candidates;
    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
       for (const part of candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
       }
    }
    
    if (response.text) {
        console.warn("Model returned text instead of image:", response.text);
        throw new Error("AI did not generate an image. Response: " + response.text);
    }

    throw new Error("No image generated.");

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message && error.message.includes('API key')) {
        throw new Error("API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong phần cài đặt.");
    }
    throw error;
  }
}

export async function generateBackgroundImage(prompt: string): Promise<string> {
    return processImage(ToolType.TEXT_TO_IMAGE, null, null, `Generate a background image: ${prompt}`);
}

export async function generateWishes(occasion: string, tone: string): Promise<string[]> {
    const genAI = getGenAI();
    const prompt = `Write 5 short, creative, and distinct wishes/messages for a ${occasion} card. Tone: ${tone}. Return ONLY the list of 5 messages separated by '|'. No other text.`;
    
    const response = await genAI.models.generateContent({
        model: TEXT_MODEL_ID,
        contents: prompt
    });
    
    const text = response.text || "";
    return text.split('|').map(s => s.trim()).filter(s => s.length > 0);
}

export async function analyzeImageStyle(base64: string, mimeType: string, lang: string): Promise<string> {
    const genAI = getGenAI();
    const prompt = `Analyze this image and describe its artistic style, color palette, mood, and composition in detail. Language: ${lang === 'vi' ? 'Vietnamese' : 'English'}. Keep it concise (under 100 words).`;
    
    const parts: any[] = [];
    const details = getBase64Details(base64, mimeType);
    if (details) {
        parts.push({ inlineData: { data: details.data, mimeType: details.mimeType } });
    }
    parts.push({ text: prompt });

    const response = await genAI.models.generateContent({
        model: TEXT_MODEL_ID,
        contents: { parts: parts }
    });

    return response.text || "Cannot analyze image.";
}