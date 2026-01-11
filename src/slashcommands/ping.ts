import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import { embedColor } from "../config";
import { getDatabasePing } from "../utils/dbPing";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with the bots ping. (Delay)"),
  async execute(interaction: CommandInteraction, client: Client) {
    try {
      const dbPing = await getDatabasePing();

      const embed = new EmbedBuilder()
        .setTitle(":ping_pong: Ping Pong!")
        .setColor(embedColor)
        .setDescription(
          `Websocket Latency: \`${client.ws.ping}ms\`\nDatabase Latency: \`${dbPing}ms\`\nShard ID: \`${interaction.guild?.shardId}\``,
        );

      return await interaction.reply({
        content: "",
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      const errorEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(
          `There was an error while executing this command! \n\`\`\`js\n${err}\`\`\``,
        );
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
