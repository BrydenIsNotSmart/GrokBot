import { Client, Events, Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { streamText } from "ai";
import { checkRateLimit, recordPromptUsage } from "../utils/rateLimit";
import { getUserModel, isReasoningModel, isImageGenerationModel } from "../utils/models";
import { generateWithWebSearch } from "../utils/webSearch";
import { db } from "../database";
import { guilds } from "../database/schema";
import { eq } from "drizzle-orm";
import { filterResponse } from "../utils/contentFilter";
import type { ResponseFilterLevel, WebSearchMode } from "../database/schema/guilds";
import { generateImageWithGrok, validateImagePrompt } from "../utils/imageGeneration";

/* ---------------------------------- Types --------------------------------- */

interface MessageContent {
  type: "text";
  text: string;
}

/* -------------------------------- Constants -------------------------------- */

const INSTRUCTIONS = `You are Grok, the AI by xAI. You are reading messages in Discord channels.
All information comes from Discord messages, including image attachments (which you cannot see but are provided as URLs and descriptions).
You are replying in Discord and may use all Discord features: Markdown, code blocks, inline code, mentions, links, emojis.
If there are images, reference them in your response using the description or URL, and if you cannot fully interpret them, ask the user for a description.

IMPORTANT: Keep your responses CONCISE and to the point. Think of this like replying to posts on X (Twitter) - short, punchy, and conversational.
- Be direct and conversational
- Avoid long explanations unless specifically asked
- If you need more space, use Discord's 2000 character limit efficiently

If a message is marked as a reply, the referenced message is conversational context
and should be treated as the immediately previous turn.

You have access to rich context about:
- The server/guild you're in
- The channel you're in
- Users (roles, join date, account age)
- Recent conversation history`;

const MAX_CONTEXT_LENGTH = 500;
const MESSAGE_CHUNK_SIZE = 2000;
const CHUNK_DELAY_MS = 150;
const EDIT_CHUNK_SIZE = 100; // Edit every 100 characters to avoid rate limits

/* -------------------------------- Utilities -------------------------------- */

function flattenContent(content: MessageContent[]): string {
  return content.map((c) => c.text).join("\n");
}

function extractImageAttachments(msg: Message): MessageContent[] {
  const images: MessageContent[] = [];
  const authorName = msg.member?.nickname || msg.author.username;

  for (const attachment of msg.attachments.values()) {
    if (attachment.contentType?.startsWith("image/") && attachment.url) {
      images.push({
        type: "text",
        text: `Discord image attachment by ${authorName}: ${attachment.url}`,
      });
    }
  }

  return images;
}

function formatAccountAge(createdAt: Date): string {
  const months =
    (new Date().getFullYear() - createdAt.getFullYear()) * 12 +
    (new Date().getMonth() - createdAt.getMonth());

  if (months < 1) return "less than a month old";
  if (months < 12) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/* ----------------------------- Context Builders ----------------------------- */

function buildServerContext(message: Message): string {
  if (!message.guild) return "Direct Message";

  const g = message.guild;
  return [
    `Server: ${g.name}`,
    `Members: ${g.memberCount}`,
    g.createdAt && `Created: ${formatTimeAgo(g.createdAt)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildChannelContext(message: Message): string {
  const c = message.channel as any;
  if (!c?.name) return "Direct Message";
  return `Channel: #${c.name}${c.topic ? ` — ${c.topic}` : ""}`;
}

function buildUserContext(msg: Message): string {
  const u = msg.author;
  const m = msg.member;
  const name = m?.nickname || u.username;

  return [
    `User: ${name}`,
    `Account Age: ${formatAccountAge(u.createdAt)}`,
    m?.joinedAt && `Joined: ${formatTimeAgo(m.joinedAt)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildMessageContent(msg: Message, isReply = false): MessageContent[] {
  const authorName = msg.member?.nickname || msg.author.username;
  const header = isReply
    ? `Referenced message from ${authorName}:`
    : `Prompt from ${authorName}:`;

  const content: MessageContent[] = [];

  if (msg.content) {
    content.push({
      type: "text",
      text: `${header} ${msg.content.slice(0, MAX_CONTEXT_LENGTH)}`,
    });
  }

  content.push(...extractImageAttachments(msg));
  return content;
}

async function buildReferencedMessageContext(
  message: Message,
): Promise<MessageContent[] | null> {
  if (!message.reference?.messageId) return null;

  try {
    const referenced = await message.channel.messages.fetch(
      message.reference.messageId,
    );
    return buildMessageContent(referenced, true);
  } catch {
    return null;
  }
}

/* ----------------------------- Message Helpers ------------------------------ */

function splitIntoChunks(text: string): string[] {
  if (text.length <= MESSAGE_CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    chunks.push(text.slice(i, i + MESSAGE_CHUNK_SIZE));
    i += MESSAGE_CHUNK_SIZE;
  }

  return chunks;
}

async function sendChunkedMessage(
  message: Message,
  text: string,
  initial?: Message,
) {
  const chunks = splitIntoChunks(text);
  if (initial) {
    await initial.edit(chunks.shift()!);
  }
  for (const chunk of chunks) {
    if (
      "send" in message.channel &&
      typeof message.channel.send === "function"
    ) {
      await message.channel.send(chunk);
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }
}

/* ---------------------------------- Handler -------------------------------- */

export default {
  name: Events.MessageCreate,
  once: false,

  async execute(message: Message, client: Client) {
    if (message.author.bot) return;

    const botId = client.user!.id;
    const mentioned =
      message.content.startsWith(`<@${botId}>`) ||
      message.content.startsWith(`<@!${botId}>`);

    let isReplyToBot = false;

    if (message.reference?.messageId) {
      try {
        const referenced = await message.channel.messages.fetch(
          message.reference.messageId,
        );
        isReplyToBot = referenced.author.id === botId;
      } catch {
        isReplyToBot = false;
      }
    }

    if (!mentioned && !isReplyToBot) return;

    const prompt = message.content.replace(/^<@!?(\d+)>/, "").trim();
    if (!prompt && !message.attachments.size) {
      return message.reply("Please provide a prompt.");
    }

    const rate = await checkRateLimit(message.author.id, message.guildId);
    if (!rate.allowed) {
      return message.reply(rate.reason ?? "Rate limited.");
    }

    /* -------------------------- Build prompt messages -------------------------- */

    const messages: { role: "system" | "user"; content: string }[] = [];

    messages.push({
      role: "system",
      content: [
        buildServerContext(message),
        buildChannelContext(message),
        buildUserContext(message),
      ].join("\n"),
    });

    const referencedContent = await buildReferencedMessageContext(message);
    if (referencedContent) {
      messages.push({
        role: "user",
        content: flattenContent(referencedContent),
      });
    }

    messages.push({
      role: "user",
      content: flattenContent(buildMessageContent(message)),
    });

    /* ----------------------------- AI Generation ----------------------------- */

    const modelId = await getUserModel(message.author.id, message.guildId);
    const isReasoning = isReasoningModel(modelId);
    const isImageGen = isImageGenerationModel(modelId);

    // Check web search settings
    let webSearchMode: WebSearchMode = "disabled";
    let enableWebSearch = false;

    if (message.guildId) {
      const guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, message.guildId),
      });
      webSearchMode = (guild?.webSearchMode as WebSearchMode) || "disabled";
      
      // Enable web search based on mode
      if (webSearchMode === "enabled") {
        enableWebSearch = true;
      } else if (webSearchMode === "auto") {
        // For auto mode, let the AI decide based on the prompt
        // We'll check for keywords that suggest current information is needed
        const currentInfoKeywords = [
          "latest", "recent", "current", "news", "today", "now", "price", "stock",
          "weather", "breaking", "update", "happening", "released", "announced"
        ];
        enableWebSearch = currentInfoKeywords.some(keyword => 
          prompt.toLowerCase().includes(keyword)
        );
      }
    }

    // Handle image generation
    if (isImageGen) {
      const cleanPrompt = prompt.replace(/^<@!?(\d+)>/, "").trim();
      
      if (!validateImagePrompt(cleanPrompt)) {
        return message.reply("❌ Invalid image prompt. Please provide a descriptive prompt between 3-1000 characters.");
      }

      let replyMsg: Message | null = null;
      try {
        replyMsg = await message.reply("🎨 Generating image...");
        
        const imageFile = await generateImageWithGrok(cleanPrompt);
        
        // Send the image as an attachment
        // Convert the image data to a Buffer if needed
        let attachmentData;
        if (typeof imageFile === 'string') {
          // If it's a URL, Discord can handle it directly
          attachmentData = imageFile;
        } else if (imageFile instanceof Buffer) {
          // If it's already a Buffer
          attachmentData = imageFile;
        } else {
          // Handle other formats (might be base64 or object)
          attachmentData = Buffer.from(imageFile);
        }
        
        const attachment = {
          attachment: attachmentData,
          name: 'generated-image.png'
        };
        
        await replyMsg.edit({
          content: `🎨 **Generated Image**\n**Prompt:** ${cleanPrompt}`,
          files: [attachment]
        });
        
        recordPromptUsage(message.author.id, message.guildId).catch(() => {});
      } catch (error) {
        console.error("Image generation error:", error);
        await replyMsg?.edit("❌ Failed to generate image. Please try again.");
      }
      return;
    }

    // Handle text generation
    let replyMsg: Message | null = null;
    let finalText = "";

    if (isReasoning) {
      replyMsg = await message.reply("🧠 Grok is reasoning...");
    }

    // Use web search if enabled
    if (enableWebSearch) {
      replyMsg = replyMsg || await message.reply("🔍 Searching the web...");
      
      const searchResult = await generateWithWebSearch(
        prompt,
        messages,
        modelId,
        true
      );

      if (searchResult.success) {
        finalText = searchResult.result || "";
      } else {
        console.error("Web search failed:", searchResult.error);
        finalText = "❌ Web search failed. Please try again.";
      }
    } else {
      // Use regular streaming generation with chunked message editing
      const result = streamText({
        model: xai.responses(modelId),
        system: INSTRUCTIONS,
        messages,
      });

      // Create initial message immediately
      replyMsg = await message.reply("...");
      
      // Edit message in larger chunks to avoid rate limits
      let lastEditLength = 0;
      for await (const chunk of result.textStream) {
        finalText += chunk;
        
        // Only edit when we've accumulated enough new content
        if (finalText.length - lastEditLength >= EDIT_CHUNK_SIZE && replyMsg) {
          try {
            await replyMsg.edit(finalText.slice(0, MESSAGE_CHUNK_SIZE));
            lastEditLength = finalText.length;
          } catch (error) {
            // If editing fails, continue collecting
            console.error("Message edit failed:", error);
          }
        }
      }
      
      // Final edit to ensure complete message is shown
      if (replyMsg && finalText.trim()) {
        try {
          await replyMsg.edit(finalText.slice(0, MESSAGE_CHUNK_SIZE));
        } catch (error) {
          console.error("Final message edit failed:", error);
        }
      }
    }

    // Apply content filtering if enabled for this server
    if (message.guildId) {
      const guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, message.guildId),
      });
      
      const filterLevel = (guild?.responseFilter || "none") as ResponseFilterLevel;
      if (filterLevel !== "none") {
        finalText = filterResponse(finalText, filterLevel);
      }
    }

    if (finalText.trim()) {
      await sendChunkedMessage(message, finalText, replyMsg ?? undefined);
      recordPromptUsage(message.author.id, message.guildId).catch(() => {});
    } else {
      replyMsg?.edit("I couldn't generate a response.");
    }
  },
};
