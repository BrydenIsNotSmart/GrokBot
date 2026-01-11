import {
  SlashCommandBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { db } from "../database";
import { users, guilds } from "../database/schema";
import { eq } from "drizzle-orm";
import { DEVELOPER_ID } from "../config";

export default {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Manage your premium subscription")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("View your premium status and benefits"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("purchase")
        .setDescription("Purchase premium subscription")
        .addStringOption((option) =>
          option
            .setName("tier")
            .setDescription("Premium tier to purchase")
            .setRequired(true)
            .addChoices(
              {
                name: "User Premium - $5/month (100 prompts/day)",
                value: "user",
              },
              {
                name: "Server Premium - $7/month (500 prompts/day)",
                value: "server",
              },
            ),
        ),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "info") {
      const userId = interaction.user.id;
      const serverId = interaction.guildId;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      const userTier =
        (user?.premiumTier as "none" | "user_premium") ||
        (user?.isPremium ? "user_premium" : "none");

      let serverTier: "none" | "server_premium" = "none";
      if (serverId) {
        const guild = await db.query.guilds.findFirst({
          where: eq(guilds.id, serverId),
        });
        serverTier =
          (guild?.premiumTier as "none" | "server_premium") || "none";
      }

      const component = new ContainerBuilder()
        .setAccentColor(16777215)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Premium Status"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Your Premium Tier\n${userTier === "user_premium" ? "✅ User Premium" : "❌ None"}`,
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Server Premium Tier\n${serverTier === "server_premium" ? "✅ Server Premium" : "❌ None"}`,
          ),
        );

      if (userTier === "user_premium") {
        component
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "### User Premium Benefits\n• 100 prompts per day\n• Custom model selection\n• Priority support",
            ),
          );
      }

      if (serverTier === "server_premium") {
        component
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "### Server Premium Benefits\n• 500 prompts per day (shared)\n• All members benefit\n• Server-wide model selection",
            ),
          );
      }

      if (userTier === "none" && serverTier === "none") {
        component
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "### Get Premium\nUse `/premium purchase` to subscribe!\n\n**User Premium ($5/month):**\n• 100 prompts/day\n• Custom model selection\n\n**Server Premium ($7/month):**\n• 500 prompts/day (shared)\n• All members benefit",
            ),
          );
      }

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } else if (subcommand === "purchase") {
      const tier = interaction.options.getString("tier", true);
      const userId = interaction.user.id;
      const serverId = interaction.guildId;

      if (tier === "user") {
        // In a real implementation, you'd integrate with Stripe/PayPal here
        // For now, we'll create a mock purchase flow

        const component = new ContainerBuilder()
          .setAccentColor(0x0b0f14)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Purchase User Premium"),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "User Premium costs **$5/month** and includes:\n" +
                "• 100 prompts per day\n" +
                "• Custom model selection\n" +
                "• Priority support",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Note:** Payment integration is required. For now, contact an administrator to activate premium.\n\n" +
                "Once payment is confirmed, an admin will activate your premium subscription.",
            ),
          );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Contact Admin")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/users/${DEVELOPER_ID}`),
        );

        await interaction.reply({
          components: [component, row],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } else if (tier === "server") {
        if (!serverId) {
          return await interaction.reply({
            content: "Server premium can only be purchased in a server!",
            flags: MessageFlags.Ephemeral,
          });
        }

        // Check if user has permission to manage the server
        const member = await interaction.guild?.members.fetch(userId);
        if (!member?.permissions.has("ManageGuild")) {
          return await interaction.reply({
            content:
              "You need the 'Manage Server' permission to purchase server premium!",
            flags: MessageFlags.Ephemeral,
          });
        }

        const component = new ContainerBuilder()
          .setAccentColor(0x0b0f14)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Purchase Server Premium"),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Server Premium costs **$7/month** and includes:\n" +
                "• 500 prompts per day (shared across all members)\n" +
                "• All members benefit from premium\n" +
                "• Server-wide model selection",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Note:** Payment integration is required. For now, contact an administrator to activate premium.\n\n" +
                "Once payment is confirmed, an admin will activate your server's premium subscription.",
            ),
          );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Contact Admin")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.com/users/YOUR_ADMIN_ID"), // Replace with actual admin ID
        );

        await interaction.reply({
          components: [component, row],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
    }
  },
};
