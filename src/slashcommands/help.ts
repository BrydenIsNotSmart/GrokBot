import { DEVELOPER_ID, embedColor } from "../config";
import {
  SlashCommandBuilder,
  Client,
  CommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  EmbedBuilder,
} from "discord.js";
import { slashcommands } from "../client";

/**
 * Checks if a user can use a command based on permissions and developer status
 */
function canUseCommand(
  command: any,
  interaction: CommandInteraction,
  isDeveloper: boolean,
): boolean {
  // Developer-only commands (check description or name)
  const developerOnlyCommands = ["eval", "admin"];
  if (developerOnlyCommands.includes(command.data.name)) {
    return isDeveloper;
  }

  // Check default member permissions
  const defaultPermissions = command.data.default_member_permissions;
  if (defaultPermissions) {
    const requiredPerms = BigInt(defaultPermissions);
    const memberPerms = interaction.memberPermissions;

    if (!memberPerms) {
      // In DMs, check if it's a permission that requires a guild
      return false;
    }

    // Check if user has required permissions
    if (!memberPerms.has(requiredPerms)) {
      return false;
    }
  }

  return true;
}

/**
 * Formats command name with subcommands
 */
function formatCommandName(command: any): string {
  const name = `/${command.data.name}`;
  const subcommands = command.data.options?.filter(
    (opt: any) => opt.type === 1, // SUB_COMMAND
  );

  if (subcommands && subcommands.length > 0) {
    return `${name} [${subcommands.map((s: any) => s.name).join(", ")}]`;
  }

  return name;
}

/**
 * Gets command description, including subcommand info
 */
function getCommandDescription(command: any): string {
  let desc = (command.data.description as string) || "No description";

  const subcommands = command.data.options?.filter(
    (opt: any) => opt.type === 1, // SUB_COMMAND
  );

  if (subcommands && subcommands.length > 0) {
    const subcommandList = subcommands
      .map(
        (s: any) =>
          `  • ${s.name}: ${(s.description as string) || "No description"}`,
      )
      .join("\n");
    desc += `\n\n**Subcommands:**\n${subcommandList}`;
  }

  return desc;
}

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Replies with ways the bot is useful!"),
  async execute(interaction: CommandInteraction, client: Client) {
    try {
      const isDeveloper = interaction.user.id === DEVELOPER_ID;
      const userPerms = interaction.memberPermissions;

      // Get all commands and filter by permissions
      const availableCommands = Array.from(slashcommands.values()).filter(
        (command) => canUseCommand(command, interaction, isDeveloper),
      );

      // Sort commands alphabetically
      availableCommands.sort((a, b) => a.data.name.localeCompare(b.data.name));

      const component = new ContainerBuilder()
        .setAccentColor(16777215)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Grok Help"),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Mentioning Grok"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `\nYou can ask me questions by simply mentioning me! You can also reply to other messages to ask me about them.`,
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Slash Commands"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        );

      if (availableCommands.length === 0) {
        component.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "You don't have permission to use any commands.",
          ),
        );
      } else {
        // Group commands into chunks to avoid message length limits
        const commandTexts: string[] = [];
        let currentGroup = "";

        for (const command of availableCommands) {
          const commandLine = `**${formatCommandName(command)}**\n${getCommandDescription(command)}`;

          // Check if adding this command would exceed reasonable length
          if (currentGroup.length + commandLine.length > 1500) {
            commandTexts.push(currentGroup);
            currentGroup = commandLine;
          } else {
            currentGroup += (currentGroup ? "\n\n" : "") + commandLine;
          }
        }

        if (currentGroup) {
          commandTexts.push(currentGroup);
        }

        // Add first group of commands
        if (commandTexts.length > 0 && commandTexts[0]) {
          component.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(commandTexts[0]),
          );
        }

        // If there are more commands, add them with separators
        for (let i = 1; i < commandTexts.length; i++) {
          const text = commandTexts[i];
          if (text) {
            component
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setSpacing(SeparatorSpacingSize.Small)
                  .setDivider(true),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text),
              );
          }
        }
      }

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } catch (error: any) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(
          `There was an error while executing this command! \n\`\`\`js\n${error.stack}\n\`\`\``,
        );
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
