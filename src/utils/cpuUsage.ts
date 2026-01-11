export function getCpuUsage(interval: number = 1000): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    const startTime = Date.now();

    setTimeout(() => {
      const elapUsage = process.cpuUsage(startUsage);
      const elapTimeMs = Date.now() - startTime;

      const elapTimeMicros = elapTimeMs * 1000;
      const cpuPercent =
        ((elapUsage.user + elapUsage.system) / elapTimeMicros) * 100;

      resolve(Math.round(cpuPercent * 100) / 100);
    }, interval);
  });
}
