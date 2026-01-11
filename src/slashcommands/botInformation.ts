import { DEVELOPER_ID, embedColor } from "../config";
import { getCpuUsage } from "../utils/cpuUsage";
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
  type MessageActionRowComponentBuilder,
  ActionRowBuilder,
  EmbedBuilder,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Replies with detailed information about the bot."),
  async execute(interaction: CommandInteraction, client: any) {
    try {
      const serverCount = await client.cluster?.broadcastEval(
        (c: Client) => c.guilds.cache.size,
      );

      const userCount = await client.cluster?.broadcastEval((c: Client) =>
        c.guilds.cache.reduce((a, b) => a + b.memberCount, 0),
      );

      const ramUsage = await client.cluster?.broadcastEval(() => {
        const gb = process.memoryUsage().heapUsed / 1024 / 1024 / 1024;
        return parseFloat(gb.toFixed(2));
      });

      const unixstamp =
        Math.floor(Date.now() / 1000) - Math.floor((client.uptime || 0) / 1000);

      const cpuUsage = await getCpuUsage();

      const shardStats = await client.cluster?.broadcastEval(async (c: any) => {
        const ping = c.ws.ping.toFixed(2);
        const servers = c.guilds.cache.size;
        const users = c.guilds.cache.reduce(
          (a: any, b: { memberCount: any }) => a + b.memberCount,
          0,
        );
        return {
          id: c.cluster.id,
          ping,
          servers,
          users,
        };
      });

      const totals = {
        servers: serverCount?.reduce((a: any, b: any) => a + b, 0) || 0,
        users: userCount || 0,
        avgPing:
          shardStats && shardStats.length
            ? (
                shardStats.reduce(
                  (a: number, b: any) => a + parseFloat(b.ping),
                  0,
                ) / shardStats.length
              ).toFixed(2)
            : 0,
      };

      const colWidths = {
        cluster: 8,
        servers: 9,
        users: 10,
        ping: 8,
      };

      const header =
        `| ${"Cluster".padEnd(colWidths.cluster)} | ${"Servers".padEnd(
          colWidths.servers,
        )} | ${"Users".padEnd(colWidths.users)} | ${"Ping".padEnd(
          colWidths.ping,
        )} |\n` +
        `|-${"-".repeat(colWidths.cluster)}-|-${"-".repeat(
          colWidths.servers,
        )}-|-${"-".repeat(colWidths.users)}-|-${"-".repeat(colWidths.ping)}-|`;

      const rows = shardStats
        ?.map(
          (s: any) =>
            `| ${s.id.toString().padEnd(colWidths.cluster)} | ${s.servers
              .toLocaleString()
              .padStart(colWidths.servers)} | ${s.users
              .toLocaleString()
              .padStart(colWidths.users)} | ${`${s.ping}ms`.padStart(
              colWidths.ping,
            )} |`,
        )
        .join("\n");

      const totalRow = `| ${"Total".padEnd(
        colWidths.cluster,
      )} | ${totals.servers
        .toLocaleString()
        .padStart(colWidths.servers)} | ${totals.users
        .toLocaleString()
        .padStart(colWidths.users)} | ${`${totals.avgPing}ms`.padStart(
        colWidths.ping,
      )} |`;

      const shardTable = `\`\`\`\n${header}\n${rows}\n${totalRow}\n\`\`\``;

      const component = new ContainerBuilder()
        .setAccentColor(16777215)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Bot Info"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `* **Developer**: <@${DEVELOPER_ID}> (brydenisnotsmart)\n* **Servers**: ${totals.servers.toLocaleString()}\n* **Users**: ${totals.users.toLocaleString()}\n * **Discord.js Version**: v${
              require("discord.js").version
            }\n* **Bun Version**: ${Bun.version}`,
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Host Info"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `* **CPU Usage**: ${cpuUsage}%\n* **RAM Usage**: ${ramUsage!
              .reduce((a: number, b: number) => a + b, 0)
              .toFixed(2)} GB\n* **Last Restart**: <t:${unixstamp}:R>`,
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Shard Info"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(shardTable),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        )

        .addActionRowComponents(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel("Support Server")
              .setEmoji({ name: "💬" })
              .setURL("https://discord.gg/q6swx4KBfR"),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel("Grok.com")
              .setEmoji({ name: "🌐" })
              .setURL("https://grok.com"),
          ),
        );

      await interaction.reply({
        components: [component],
        flags: MessageFlags.IsComponentsV2,
      });
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
