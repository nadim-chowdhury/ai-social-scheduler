#!/usr/bin/env node

/**
 * Worker startup script
 * This script starts all background workers for the AI Social Scheduler
 */

const { getWorkerManager } = require("../src/workers/index.ts");

async function startWorkers() {
  console.log("🚀 Starting AI Social Scheduler Workers...");
  console.log("=====================================");

  try {
    const workerManager = getWorkerManager();
    await workerManager.startAll();

    console.log("=====================================");
    console.log("✅ All workers started successfully!");
    console.log("Workers running:");
    console.log("- Post Scheduler Worker");
    console.log("- Post Publisher Worker");
    console.log("- Analytics Sync Worker");
    console.log("- AI Generation Worker");
    console.log("=====================================");
    console.log("Press Ctrl+C to stop all workers");

    // Keep the process alive
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down workers...");
      await workerManager.stopAll();
      console.log("✅ All workers stopped");
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down workers...");
      await workerManager.stopAll();
      console.log("✅ All workers stopped");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start workers
startWorkers();
