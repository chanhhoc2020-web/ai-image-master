import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// We use the environment variable for the API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EditOptions {
  image: string; // Base64 string
  prompt: string;
}

/**
 * Edits an image using Gemini 2.5 Flash Image model
 */
export async function editImage(options: EditOptions): Promise<string> {
  const { image, prompt } = options;

  // Remove data URL prefix if present to get raw base64
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Edit this portrait image. ${prompt}. Return ONLY the edited image.`,
          },
        ],
      },
    });

    // Extract the image from the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated in response");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
}
