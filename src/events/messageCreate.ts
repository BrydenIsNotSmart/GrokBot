import { Client, Events, Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { streamText } from "ai";
import { checkRateLimit, recordPromptUsage } from "../utils/rateLimit";
import { getUserModel, isReasoningModel, isImageGenerationModel } from "../utils/models";
import { db } from "../database";
import { guilds } from "../database/schema";
import { eq } from "drizzle-orm";
import { filterResponse } from "../utils/contentFilter";
import type { ResponseFilterLevel } from "../database/schema/guilds";
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
Be aware that Discord messages must be 2000 characters or fewer. Shorten or summarize if necessary.

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
        const attachment = {
          attachment: imageFile,
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

    const result = streamText({
      model: xai.responses(modelId),
      system: INSTRUCTIONS,
      messages,
    });

    for await (const chunk of result.textStream) {
      finalText += chunk;
      if (!replyMsg && chunk.trim()) {
        replyMsg = await message.reply(chunk.slice(0, MESSAGE_CHUNK_SIZE));
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
