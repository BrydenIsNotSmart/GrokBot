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
import {
  AVAILABLE_MODELS,
  setUserModel,
  getUserModel,
  type ModelId,
} from "../utils/models";
import { db } from "../database";
import { users, guilds } from "../database/schema";
import { eq } from "drizzle-orm";

export default {
  data: new SlashCommandBuilder()
    .setName("model")
    .setDescription("Manage your AI model preference (Premium only)")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all available models"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set your preferred model")
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("The model to use")
            .setRequired(true)
            .addChoices(
              ...AVAILABLE_MODELS.map((model) => ({
                name: `${model.name}${model.default ? " (Default)" : ""}`,
                value: model.id,
              })),
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("current")
        .setDescription("View your current model preference"),
    ),
  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const serverId = interaction.guildId;

    // Check premium status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const userTier =
      (user?.premiumTier as "none" | "user_premium") ||
      (user?.isPremium ? "user_premium" : "none");

    let hasPremium = userTier === "user_premium";

    if (!hasPremium && serverId) {
      const guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, serverId),
      });
      const serverTier =
        (guild?.premiumTier as "none" | "server_premium") || "none";
      hasPremium = serverTier === "server_premium";
    }

    if (subcommand === "list") {
      const component = new ContainerBuilder()
        .setAccentColor(16777215)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Available Models"),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            hasPremium
              ? "Choose a model using `/model set`"
              : "**Premium Required**\nUpgrade to premium to choose your preferred model!\nUse `/premium purchase` to subscribe.",
          ),
        );

      for (const model of AVAILABLE_MODELS) {
        component
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### ${model.name}${model.default ? " ⭐ (Default)" : ""}\n${model.description}`,
            ),
          );
      }

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } else if (subcommand === "set") {
      if (!hasPremium) {
        return await interaction.reply({
          content:
            "❌ You need premium to change models! Use `/premium purchase` to subscribe.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const modelId = interaction.options.getString("model", true) as ModelId;
      const result = await setUserModel(userId, modelId);

      if (result.success) {
        const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
        await interaction.reply({
          content: `✅ Model changed to **${model?.name || modelId}**!\nYour future prompts will use this model.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: `❌ ${result.error || "Failed to change model"}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === "current") {
      const currentModelId = await getUserModel(userId, serverId);
      const currentModel = AVAILABLE_MODELS.find(
        (m) => m.id === currentModelId,
      );

      const component = new ContainerBuilder()
        .setAccentColor(0x0b0f14)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Current Model"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            hasPremium
              ? `You're currently using **${currentModel?.name || currentModelId}**\n\nUse \`/model set\` to change your model.`
              : `You're using the default model: **${currentModel?.name || currentModelId}**\n\nUpgrade to premium to choose your preferred model!`,
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Model Details\n${currentModel?.description || "No description available"}`,
          ),
        );

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  },
};
