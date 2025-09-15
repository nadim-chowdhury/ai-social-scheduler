import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

// Redis connection configuration
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  maxLoadingTimeout: 1000,
});

// Queue names
export const QUEUE_NAMES = {
  POST_SCHEDULER: "post-scheduler",
  POST_PUBLISHER: "post-publisher",
  ANALYTICS_SYNC: "analytics-sync",
  AI_GENERATION: "ai-generation",
} as const;

// Job types
export interface PostSchedulerJob {
  postId: string;
  workspaceId: string;
  socialAccountId: string;
  scheduledAt: string;
  attempt?: number;
}

export interface PostPublisherJob {
  postId: string;
  workspaceId: string;
  socialAccountId: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  attempt?: number;
}

export interface AnalyticsSyncJob {
  postId: string;
  platform: string;
  platformPostId: string;
  attempt?: number;
}

export interface AIGenerationJob {
  requestId: string;
  workspaceId: string;
  type: "text" | "image";
  prompt: string;
  provider?: string;
  attempt?: number;
}

// Create queues
export const postSchedulerQueue = new Queue<PostSchedulerJob>(
  QUEUE_NAMES.POST_SCHEDULER,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  }
);

export const postPublisherQueue = new Queue<PostPublisherJob>(
  QUEUE_NAMES.POST_PUBLISHER,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  }
);

export const analyticsSyncQueue = new Queue<AnalyticsSyncJob>(
  QUEUE_NAMES.ANALYTICS_SYNC,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10000,
      },
    },
  }
);

export const aiGenerationQueue = new Queue<AIGenerationJob>(
  QUEUE_NAMES.AI_GENERATION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    },
  }
);

// Queue management functions
export async function addPostSchedulerJob(
  data: PostSchedulerJob,
  delay?: number
) {
  return postSchedulerQueue.add("schedule-post", data, {
    delay: delay || 0,
  });
}

export async function addPostPublisherJob(
  data: PostPublisherJob,
  delay?: number
) {
  return postPublisherQueue.add("publish-post", data, {
    delay: delay || 0,
  });
}

export async function addAnalyticsSyncJob(
  data: AnalyticsSyncJob,
  delay?: number
) {
  return analyticsSyncQueue.add("sync-analytics", data, {
    delay: delay || 0,
  });
}

export async function addAIGenerationJob(
  data: AIGenerationJob,
  delay?: number
) {
  return aiGenerationQueue.add("generate-content", data, {
    delay: delay || 0,
  });
}

// Queue health check
export async function checkQueueHealth() {
  const queues = [
    { name: "Post Scheduler", queue: postSchedulerQueue },
    { name: "Post Publisher", queue: postPublisherQueue },
    { name: "Analytics Sync", queue: analyticsSyncQueue },
    { name: "AI Generation", queue: aiGenerationQueue },
  ];

  const health = await Promise.all(
    queues.map(async ({ name, queue }) => {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      return {
        name,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        isHealthy: failed.length < 10, // Consider unhealthy if more than 10 failed jobs
      };
    })
  );

  return health;
}

// Cleanup function
export async function cleanupQueues() {
  await Promise.all([
    postSchedulerQueue.close(),
    postPublisherQueue.close(),
    analyticsSyncQueue.close(),
    aiGenerationQueue.close(),
  ]);
  await redisConnection.quit();
}
