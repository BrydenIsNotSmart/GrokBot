import { Client, Events, Message, Attachment } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message, client: Client) {
    if (message.author.bot) return;

    const botId = client.user!.id;

    // Check if bot is mentioned
    const botMentioned =
      message.content.startsWith(`<@${botId}>`) ||
      message.content.startsWith(`<@!${botId}>`);

    if (!botMentioned) return;

    const prompt = message.content.replace(/^<@!?(\d+)>/, "").trim();

    const contextMessages: any[] = [];

    // Include replied-to message context if exists
    if (message.reference?.messageId) {
      try {
        const repliedMessage = await message.channel.messages.fetch(
          message.reference.messageId,
        );

        const replyContent: any[] = [];

        // Get author info: username, nickname
        const authorName =
          repliedMessage.member?.nickname || repliedMessage.author.username;
        const authorBio = "No bio available"; // replace with actual bio if you have one

        if (repliedMessage.content) {
          replyContent.push({
            type: "text",
            text: `${authorName} (${authorBio}) said: ${repliedMessage.content.slice(
              0,
              500,
            )}`,
          });
        }

        // Add images if present
        repliedMessage.attachments.forEach((attachment: Attachment) => {
          if (attachment.contentType?.startsWith("image/")) {
            replyContent.push({
              type: "image",
              image: new URL(attachment.url),
            });
          }
        });

        if (replyContent.length) {
          contextMessages.push({
            role: "user",
            content: replyContent,
          });
        }
      } catch (err) {
        console.error("Failed to fetch replied message:", err);
      }
    }

    // Add the prompt message with author info
    const promptAuthorName =
      message.member?.nickname || message.author.username;
    const promptAuthorBio = "No bio available"; // replace if you store bios

    contextMessages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `${promptAuthorName} (${promptAuthorBio}) asked: ${prompt}`,
        },
      ],
    });

    try {
      // Typing indicator
      message.channel.sendTyping();

      // Send a placeholder while generating
      const thinkingMessage = await message.reply("Grok is thinking...");

      // AI generation
      const { text } = await generateText({
        model: xai.responses("grok-4"),
        messages: contextMessages,
        instructions:
          "You are Grok, the AI by xAI. Respond helpfully, concisely, and friendly, taking into account usernames, nicknames, and bios of the message authors.",
      });

      // Simulate streaming by splitting text into chunks
      if (text) {
        const chunkSize = 80; // number of characters per edit
        let sentText = "";
        for (let i = 0; i < text.length; i += chunkSize) {
          sentText += text.slice(i, i + chunkSize);
          await thinkingMessage.edit(sentText);
          // small delay to make it feel like streaming
          await new Promise((r) => setTimeout(r, 250));
        }
      } else {
        await thinkingMessage.edit("Sorry, I couldn't generate a response.");
      }
    } catch (err) {
      console.error("AI generation error:", err);
      await message.reply("There was an error generating the response.");
    }
  },
};
