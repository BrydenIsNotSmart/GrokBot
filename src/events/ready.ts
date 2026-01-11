import { Events, Client } from "discord.js";
import { CUSTOM_STATUSES, STATUS_UPDATE_INTERVAL } from "../config";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    console.info(`[INFO] ${client.user?.tag} is online and ready.`);

    const updateStatus = () => {
      const random =
        CUSTOM_STATUSES[Math.floor(Math.random() * CUSTOM_STATUSES.length)];
      client.user?.setActivity(random!.text, { type: random!.type });
    };

    updateStatus();
    setInterval(updateStatus, STATUS_UPDATE_INTERVAL);
  },
};
