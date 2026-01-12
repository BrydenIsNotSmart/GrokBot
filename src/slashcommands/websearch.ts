import {
  SlashCommandBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { db } from "../database";
import { guilds, type WebSearchMode } from "../database/schema/guilds";
import { eq } from "drizzle-orm";

export default {
  data: new SlashCommandBuilder()
    .setName("websearch")
    .setDescription("Manage web search settings (Premium only)")
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("View current web search settings"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set web search mode")
        .addStringOption((option) =>
          option
            .setName("mode")
            .setDescription("Web search mode")
            .setRequired(true)
            .addChoices(
              { name: "Disabled - No web search", value: "disabled" },
              { name: "Enabled - Always use web search", value: "enabled" },
              { name: "Auto - Use web search when needed", value: "auto" },
            ),
        ),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const serverId = interaction.guildId;

    if (!serverId) {
      return await interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check premium status
    const guild = await db.query.guilds.findFirst({
      where: eq(guilds.id, serverId),
    });

    const serverTier = (guild?.premiumTier as "none" | "server_premium") || "none";
    const hasPremium = serverTier === "server_premium";

    if (!hasPremium) {
      return await interaction.reply({
        content:
          "❌ Web search requires server premium! Use `/premium purchase` to subscribe.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "status") {
      const currentMode = (guild?.webSearchMode as WebSearchMode) || "disabled";
      
      const modeDescriptions = {
        disabled: "🚫 **Disabled** - Web search is not available",
        enabled: "✅ **Enabled** - Web search is always used for responses",
        auto: "🤖 **Auto** - Web search is used when the AI determines it's needed",
      };

      const component = new ContainerBuilder()
        .setAccentColor(0x1a73e8)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## 🔍 Web Search Status"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Current Mode:** ${modeDescriptions[currentMode]}`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "### How it works\n\n" +
            "• **Disabled**: The AI uses only its training data\n" +
            "• **Enabled**: The AI always searches the web for current information\n" +
            "• **Auto**: The AI decides when to search based on your query\n\n" +
            "Use `/websearch set` to change the mode.",
          ),
        );

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } else if (subcommand === "set") {
      const mode = interaction.options.getString("mode", true) as WebSearchMode;

      await db
        .update(guilds)
        .set({ webSearchMode: mode })
        .where(eq(guilds.id, serverId));

      const modeDescriptions = {
        disabled: "disabled - The AI will use only its training data",
        enabled: "enabled - The AI will always search the web",
        auto: "auto - The AI will search when it thinks it's needed",
      };

      await interaction.reply({
        content: `✅ Web search mode set to **${modeDescriptions[mode]}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
