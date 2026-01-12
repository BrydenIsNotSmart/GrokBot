import {
  SlashCommandBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../database";
import { guilds } from "../database/schema";
import { eq } from "drizzle-orm";
import type { ResponseFilterLevel } from "../database/schema/guilds";

export default {
  data: new SlashCommandBuilder()
    .setName("responsefilter")
    .setDescription("Configure AI response filtering for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the response filter level")
        .addStringOption((option) =>
          option
            .setName("level")
            .setDescription("Filter level to apply")
            .setRequired(true)
            .addChoices(
              { name: "None (no filtering)", value: "none" },
              { name: "Relaxed (filter slurs only)", value: "relaxed" },
              { name: "Extreme (filter all curse words)", value: "extreme" },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check the current response filter status"),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) {
      return await interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const level = interaction.options.getString("level", true) as ResponseFilterLevel;

      let guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, interaction.guildId),
      });

      if (!guild) {
        await db.insert(guilds).values({
          id: interaction.guildId,
          responseFilter: level,
        });
      } else {
        await db
          .update(guilds)
          .set({ responseFilter: level })
          .where(eq(guilds.id, interaction.guildId));
      }

      const levelDescriptions = {
        none: "No filtering - AI responses are completely unfiltered",
        relaxed: "Relaxed filtering - Only severe slurs and offensive language are censored",
        extreme: "Extreme filtering - All curse words and inappropriate language are censored",
      };

      const component = new ContainerBuilder()
        .setAccentColor(0x00ff00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## ✅ Response Filter Updated"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### New Filter Level\n**${level.charAt(0).toUpperCase() + level.slice(1)}**`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Description\n${levelDescriptions[level]}`,
          ),
        );

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } else if (subcommand === "status") {
      const guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, interaction.guildId),
      });

      const currentLevel = guild?.responseFilter || "none";

      const levelDescriptions = {
        none: "No filtering - AI responses are completely unfiltered",
        relaxed: "Relaxed filtering - Only severe slurs and offensive language are censored",
        extreme: "Extreme filtering - All curse words and inappropriate language are censored",
      };

      const levelColors = {
        none: 0x808080,
        relaxed: 0xffff00,
        extreme: 0xff0000,
      };

      const component = new ContainerBuilder()
        .setAccentColor(levelColors[currentLevel as keyof typeof levelColors])
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## 📊 Response Filter Status"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Current Filter Level\n**${currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}**`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Description\n${levelDescriptions[currentLevel as keyof typeof levelDescriptions]}`,
          ),
        );

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  },
};
