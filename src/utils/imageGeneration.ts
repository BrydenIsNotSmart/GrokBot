import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

/**
 * Generates an image using the grok-2-image-1212 model
 * @param prompt - The text prompt to generate an image from
 * @returns Promise resolving to the GeneratedFile object
 */
export async function generateImageWithGrok(prompt: string): Promise<any> {
  try {
    const { image } = await generateImage({
      model: xai.image("grok-2-image-1212"),
      prompt: prompt,
      size: "1024x1024",
      n: 1,
    });

    return image;
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
