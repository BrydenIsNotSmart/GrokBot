import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

/**
 * Generates an image using the grok-2-image-1212 model
 * @param prompt - The text prompt to generate an image from
 * @returns Promise resolving to image data in Discord-compatible format
 */
export async function generateImageWithGrok(prompt: string): Promise<Buffer | string> {
  try {
    const { image } = await generateImage({
      model: xai.image("grok-2-image-1212"),
      prompt: prompt,
      n: 1,
    });

    // Handle different response formats from the AI SDK
    if (typeof image === 'string') {
      // If it's a URL, return as string
      return image;
    } else if (image && typeof image === 'object') {
      // If it's an object with data property (base64)
      const imgObj = image as any;
      if ('data' in imgObj && typeof imgObj.data === 'string') {
        return Buffer.from(imgObj.data, 'base64');
      }
      // If it has other properties, try to convert to string then Buffer
      return Buffer.from(JSON.stringify(imgObj));
    }
    
    // Fallback: return empty buffer (shouldn't reach here)
    throw new Error('Unexpected image format received from AI API');
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
}

/**
 * Validates if a prompt is appropriate for image generation
 * @param prompt - The text prompt to validate
 * @returns boolean indicating if the prompt is valid
 */
export function validateImagePrompt(prompt: string): boolean {
  // Basic validation - ensure prompt is not empty and has reasonable length
  const trimmedPrompt = prompt.trim();
  
  if (!trimmedPrompt || trimmedPrompt.length < 3) {
    return false;
  }
  
  if (trimmedPrompt.length > 1000) {
    return false;
  }
  
  // Could add more sophisticated content filtering here if needed
  return true;
}
