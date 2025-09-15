import { PostSchedulerWorker } from "./post-scheduler-worker";
import { PostPublisherWorker } from "./post-publisher-worker";
import { AnalyticsSyncWorker } from "./analytics-sync-worker";
import { AIGenerationWorker } from "./ai-generation-worker";

export class WorkerManager {
  private workers: {
    postScheduler: PostSchedulerWorker;
    postPublisher: PostPublisherWorker;
    analyticsSync: AnalyticsSyncWorker;
    aiGeneration: AIGenerationWorker;
  };

  constructor() {
    this.workers = {
      postScheduler: new PostSchedulerWorker(),
      postPublisher: new PostPublisherWorker(),
      analyticsSync: new AnalyticsSyncWorker(),
      aiGeneration: new AIGenerationWorker(),
    };
  }

  async startAll() {
    console.log("Starting all workers...");

    const startPromises = Object.entries(this.workers).map(
      async ([name, worker]) => {
        try {
          await worker.start();
          console.log(`${name} worker started successfully`);
        } catch (error) {
          console.error(`Failed to start ${name} worker:`, error);
          throw error;
        }
      }
    );

    await Promise.all(startPromises);
    console.log("All workers started successfully");
  }

  async stopAll() {
    console.log("Stopping all workers...");

    const stopPromises = Object.entries(this.workers).map(
      async ([name, worker]) => {
        try {
          await worker.stop();
          console.log(`${name} worker stopped successfully`);
        } catch (error) {
          console.error(`Failed to stop ${name} worker:`, error);
        }
      }
    );

    await Promise.all(stopPromises);
    console.log("All workers stopped");
  }

  getWorker(name: keyof typeof this.workers) {
    return this.workers[name];
  }

  getAllWorkers() {
    return this.workers;
  }

  // Health check for all workers
  async getHealthStatus() {
    const health = await Promise.all(
      Object.entries(this.workers).map(async ([name, worker]) => {
        const workerInstance = worker.getWorker();
        return {
          name,
          isRunning: workerInstance.isRunning(),
          isPaused: workerInstance.isPaused(),
        };
      })
    );

    return health;
  }
}

// Singleton instance
let workerManager: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager();
  }
  return workerManager;
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down workers gracefully...");
  if (workerManager) {
    await workerManager.stopAll();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down workers gracefully...");
  if (workerManager) {
    await workerManager.stopAll();
  }
  process.exit(0);
});

// Export individual workers for direct use
export {
  PostSchedulerWorker,
  PostPublisherWorker,
  AnalyticsSyncWorker,
  AIGenerationWorker,
};
