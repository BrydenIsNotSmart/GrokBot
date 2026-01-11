import path from "path";
import * as fs from "fs";
import { ClusterManager } from "discord-hybrid-sharding";
import { botToken } from "./config";

//-Sharding-//
const jsEntry = path.join(__dirname, "client.js");
const tsEntry = path.join(__dirname, "client.ts");
const entry = fs.existsSync(jsEntry) ? jsEntry : tsEntry;
const manager = new ClusterManager(entry, {
  shardsPerClusters: 4,
  totalShards: "auto",
  mode: "process",
  token: botToken,
  execArgv: ["--max-old-space-size=6000"],
});

manager.on("clusterCreate", (cluster) => {
  cluster.on("ready", () => {
    console.log(`[Cluster Manager] Cluster ${cluster.id} ready`);
  });
  cluster.on("reconnecting", () => {
    console.log(`[Cluster Manager] Cluster ${cluster.id} reconnecting`);
  });
  console.log(`[Cluster Manager] Cluster ${cluster.id} created`);
});

manager.spawn({ timeout: -1 });
