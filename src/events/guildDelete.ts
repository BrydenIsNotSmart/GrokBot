import {
  Events,
  Client,
  Guild,
  type GuildTextBasedChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from "discord.js";
import { newGuildsChannelId } from "../config";

export default {
  name: Events.GuildDelete,
  once: false,
  async execute(guild: Guild, client: Client) {
    const newGuildComponent = new ContainerBuilder()
      .setAccentColor(15277667)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Removed Guild"),
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              guild.iconURL()! ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  guild.name,
                ).replace(/%20/g, "+")}&background=272727&color=ababab`,
            ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `* **Name**: ${guild.name}\n * **Owner**: ${
                (await client.users.fetch(guild.ownerId!)).username
              } (${guild.ownerId})\n * **ID**: ${
                guild.id
              }\n * **Member Count**: ${guild.memberCount}`,
            ),
          ),
      );

    client.channels.fetch(newGuildsChannelId).then((channel) => {
      (channel as GuildTextBasedChannel).send({
        components: [newGuildComponent],
        flags: MessageFlags.IsComponentsV2,
      });
    });
  },
};
