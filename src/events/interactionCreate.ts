import {
  Events,
  EmbedBuilder,
  CommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { cooldown, slashcommands } from "../client";
import { COOLDOWN_MS, embedColor } from "../config";
import { users, guilds } from "../database/schema";
import { db } from "../database";
import { eq } from "drizzle-orm";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.isChatInputCommand()) return;

    const command = slashcommands.get(interaction.commandName);
    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return await interaction.reply({
        content: `No command matching ${interaction.commandName} was found.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const cooldownMs: number =
      typeof command.cooldownMs === "number" ? command.cooldownMs : COOLDOWN_MS;

    const userId = interaction.user.id;
    const lastUsed = cooldown.get(userId) ?? 0;
    const elapsed = Date.now() - lastUsed;

    if (elapsed < cooldownMs) {
      const remainingMs = Math.max(0, cooldownMs - elapsed);
      const remainingSec = (remainingMs / 1000).toFixed(1);
      return await interaction.reply({
        content: `You are on cooldown!\nPlease try again in ${remainingSec}s.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, interaction.user.id),
      });

      if (user) {
        await db
          .update(users)
          .set({ commandsRan: user.commandsRan!++ })
          .where(eq(users.id, interaction.user.id));
      } else {
        await db
          .insert(users)
          .values({ id: interaction.user.id, commandsRan: 1 });
      }

      const guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, interaction.guildId!),
      });

      if (guild) {
        await db
          .update(guilds)
          .set({ commandsRan: guild.commandsRan!++ })
          .where(eq(guilds.id, interaction.guildId!));
      } else {
        await db
          .insert(guilds)
          .values({ id: interaction.guildId!, commandsRan: 1 });
      }

      await command.execute(interaction, client);
      cooldown.set(userId, Date.now());
    } catch (error: any) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(
          `There was an error while executing this command! \n\`\`\`js\n${error.stack}\`\`\``,
        );
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
