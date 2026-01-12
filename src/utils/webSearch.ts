import { webSearch } from "@exalabs/ai-sdk";
import { generateText, stepCountIs } from "ai";
import { xai } from "@ai-sdk/xai";

/**
 * Performs web search using Exa API and processes results with xAI
 */
export async function performWebSearch(
  query: string,
  modelId: string = "grok-4-fast-non-reasoning"
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const { text } = await generateText({
      model: xai.responses(modelId),
      prompt: `Search the web for: ${query}`,
      system: "You are a helpful AI assistant with web search capabilities. Use the web search tool to find current information and provide accurate, up-to-date answers. Always cite your sources when possible.",
      tools: {
        webSearch: webSearch({
          type: "auto", // intelligent hybrid search
          numResults: 5, // return up to 5 results
          contents: {
            text: {
              maxCharacters: 2000, // get up to 2000 chars per result
            },
            livecrawl: "fallback", // fresh content when needed
            summary: true, // return AI-generated summary for each result
          },
        }),
      },
      stopWhen: stepCountIs(3), // Allow tool use and response generation
    });

    return { success: true, result: text };
  } catch (error) {
    console.error("Web search error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown web search error" 
    };
  }
}

/**
 * Enhanced AI generation with optional web search
 */
export async function generateWithWebSearch(
  prompt: string,
  messages: { role: "system" | "user"; content: string }[],
  modelId: string,
  enableWebSearch: boolean = false
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    if (!enableWebSearch) {
      // Regular generation without web search
      const { streamText } = await import("ai");
      const result = streamText({
        model: xai.responses(modelId),
        system: messages.find(m => m.role === "system")?.content,
        messages: messages.filter(m => m.role === "user"),
      });
      
      // Collect the full response
      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      
      return { success: true, result: fullText };
    }

    // Enhanced generation with web search
    const { generateText } = await import("ai");
    const { text } = await generateText({
      model: xai.responses(modelId),
      system: `${messages.find(m => m.role === "system")?.content}

You have access to web search. Use it when the user asks for:
- Current events or recent information
- Time-sensitive data
- Latest news or developments
- Real-time information

Only use web search when necessary. For general knowledge, reasoning, or creative tasks, use your existing knowledge.`,
      messages: messages.filter(m => m.role === "user"),
      tools: {
        webSearch: webSearch({
          type: "auto",
          numResults: 3,
          contents: {
            text: { maxCharacters: 1500 },
            livecrawl: "fallback",
            summary: true,
          },
        }),
      },
      stopWhen: stepCountIs(3),
    });

    return { success: true, result: text };
  } catch (error) {
    console.error("Generation error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown generation error" 
    };
  }
}
