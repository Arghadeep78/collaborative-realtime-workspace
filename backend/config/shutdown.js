export function registerShutdownHandlers({ server, pubClient, subClient, persistWorker, publishWorker, publishQueue, stopScheduler }) {
  const shutdown = async (signal) => {
    console.log(`🛑 Received ${signal}, shutting down...`);
    stopScheduler();
    await Promise.allSettled([
      persistWorker?.close(),
      publishWorker?.close(),
      publishQueue?.close(),
    ]);
    await Promise.allSettled([
      pubClient.quit(),
      subClient.quit(),
    ]);
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2'));
}
