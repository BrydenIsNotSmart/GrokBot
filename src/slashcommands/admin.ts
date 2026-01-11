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
import { DEVELOPER_ID } from "../config";
import { db } from "../database";
import { users, guilds } from "../database/schema";
import { eq } from "drizzle-orm";

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin commands for managing premium subscriptions")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("activate-premium")
        .setDescription("Activate premium for a user or server")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("User or server premium")
            .setRequired(true)
            .addChoices(
              { name: "User Premium", value: "user" },
              { name: "Server Premium", value: "server" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("User ID or Server ID")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("deactivate-premium")
        .setDescription("Deactivate premium for a user or server")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("User or server premium")
            .setRequired(true)
            .addChoices(
              { name: "User Premium", value: "user" },
              { name: "Server Premium", value: "server" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("User ID or Server ID")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check-premium")
        .setDescription("Check premium status for a user or server")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("User or server")
            .setRequired(true)
            .addChoices(
              { name: "User", value: "user" },
              { name: "Server", value: "server" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("User ID or Server ID")
            .setRequired(true),
        ),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    // Only allow developer/admin to use this
    if (interaction.user.id !== DEVELOPER_ID) {
      return await interaction.reply({
        content: "❌ This command is only available to the bot developer.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const type = interaction.options.getString("type", true);
    const id = interaction.options.getString("id", true);

    if (subcommand === "activate-premium") {
      if (type === "user") {
        let user = await db.query.users.findFirst({
          where: eq(users.id, id),
        });

        if (!user) {
          await db.insert(users).values({
            id,
            premiumTier: "user_premium",
            isPremium: true,
            preferredModel: "grok-4-fast-non-reasoning",
          });
        } else {
          await db
            .update(users)
            .set({
              premiumTier: "user_premium",
              isPremium: true,
            })
            .where(eq(users.id, id));
        }

        await interaction.reply({
          content: `✅ User Premium activated for <@${id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (type === "server") {
        let guild = await db.query.guilds.findFirst({
          where: eq(guilds.id, id),
        });

        if (!guild) {
          await db.insert(guilds).values({
            id,
            premiumTier: "server_premium",
          });
        } else {
          await db
            .update(guilds)
            .set({
              premiumTier: "server_premium",
            })
            .where(eq(guilds.id, id));
        }

        await interaction.reply({
          content: `✅ Server Premium activated for server ${id}!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === "deactivate-premium") {
      if (type === "user") {
        await db
          .update(users)
          .set({
            premiumTier: "none",
            isPremium: false,
          })
          .where(eq(users.id, id));

        await interaction.reply({
          content: `✅ User Premium deactivated for <@${id}>`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (type === "server") {
        await db
          .update(guilds)
          .set({
            premiumTier: "none",
          })
          .where(eq(guilds.id, id));

        await interaction.reply({
          content: `✅ Server Premium deactivated for server ${id}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === "check-premium") {
      if (type === "user") {
        const user = await db.query.users.findFirst({
          where: eq(users.id, id),
        });

        const userTier =
          (user?.premiumTier as "none" | "user_premium") ||
          (user?.isPremium ? "user_premium" : "none");

        const component = new ContainerBuilder()
          .setAccentColor(16777215)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## User Premium Status"),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`User: <@${id}>`),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Premium Tier\n${userTier === "user_premium" ? "✅ User Premium" : "❌ None"}`,
            ),
          );

        if (user?.preferredModel) {
          component
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
                .setDivider(true),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### Preferred Model\n${user.preferredModel}`,
              ),
            );
        }

        await interaction.reply({
          components: [component],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } else if (type === "server") {
        const guild = await db.query.guilds.findFirst({
          where: eq(guilds.id, id),
        });

        const serverTier =
          (guild?.premiumTier as "none" | "server_premium") || "none";

        const component = new ContainerBuilder()
          .setAccentColor(0x0b0f14)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Server Premium Status"),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Server ID: ${id}`),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Premium Tier\n${serverTier === "server_premium" ? "✅ Server Premium" : "❌ None"}`,
            ),
          );

        if (guild?.promptsUsedToday !== undefined) {
          component
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
                .setDivider(true),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### Prompts Used Today\n${guild.promptsUsedToday}/500`,
              ),
            );
        }

        await interaction.reply({
          components: [component],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
    }
  },
};
