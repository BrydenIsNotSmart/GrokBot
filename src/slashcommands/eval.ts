import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import { embedColor, DEVELOPER_ID } from "../config";
import { db } from "../database";

export default {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Evaluate JavaScript code (Owner only)")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The JavaScript code to evaluate")
        .setRequired(true),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    try {
      // Only allow bot owners
      if (DEVELOPER_ID != interaction.user.id) {
        return await interaction.reply({
          content: "You are not allowed to use this command.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const code = interaction.options.getString("code", true);

      let evaled: any;
      try {
        // Evaluate code
        evaled = eval(code);
        // If it's a Promise, await it
        if (evaled instanceof Promise) evaled = await evaled;
      } catch (err) {
        evaled = err;
      }

      // Convert output to string safely
      let output = String(evaled);

      // Redact bot token or any process.env secrets
      const tokenRegex = new RegExp(client.token!, "g");
      output = output.replace(tokenRegex, "[REDACTED]");

      // Also redact anything that looks like environment variables
      output = output.replace(/process\.env\.[A-Z_]+/g, "[REDACTED]");

      // Limit output length
      if (output.length > 1900) output = output.slice(0, 1900) + "...";

      const embed = new EmbedBuilder()
        .setTitle("Eval Result")
        .setColor(embedColor)
        .addFields(
          { name: "Input", value: `\`\`\`js\n${code}\n\`\`\`` },
          { name: "Output", value: `\`\`\`js\n${output}\n\`\`\`` },
        );

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      const errorEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(
          `There was an error while executing this command! \n\`\`\`js\n${err}\n\`\`\``,
        );
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
