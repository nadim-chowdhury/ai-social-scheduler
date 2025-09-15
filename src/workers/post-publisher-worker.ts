import { Worker, Job } from "bullmq";
import {
  QUEUE_NAMES,
  PostPublisherJob,
  addAnalyticsSyncJob,
} from "@/lib/queue";
import { supabaseAdmin } from "@/lib/supabase";
import {
  SocialPublisherFactory,
  getSocialAccount,
} from "@/lib/social-publishers";

export class PostPublisherWorker {
  private worker: Worker<PostPublisherJob>;

  constructor() {
    this.worker = new Worker<PostPublisherJob>(
      QUEUE_NAMES.POST_PUBLISHER,
      this.processJob.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 3, // Lower concurrency for publishing
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<PostPublisherJob>) {
    const {
      postId,
      workspaceId,
      socialAccountId,
      platform,
      content,
      mediaUrls,
    } = job.data;

    console.log(
      `Processing post publisher job for post ${postId} on ${platform}`
    );

    try {
      // Get social account details
      const account = await getSocialAccount(socialAccountId);
      if (!account) {
        throw new Error(
          `Social account ${socialAccountId} not found or inactive`
        );
      }

      // Verify the post is still in posting status
      const { data: post, error: postError } = await supabaseAdmin
        .from("posts")
        .select("*")
        .eq("id", postId)
        .eq("status", "posting")
        .single();

      if (postError || !post) {
        console.log(
          `Post ${postId} not found or not in posting status, skipping`
        );
        return;
      }

      // Publish to social platform
      const result = await SocialPublisherFactory.publishPost(account, {
        content,
        mediaUrls,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to publish post");
      }

      // Update post status to posted
      await supabaseAdmin
        .from("posts")
        .update({
          status: "posted",
          platform_post_id: result.platformPostId,
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      console.log(
        `Post ${postId} published successfully with platform ID: ${result.platformPostId}`
      );

      // Schedule analytics sync
      if (result.platformPostId) {
        await addAnalyticsSyncJob({
          postId,
          platform,
          platformPostId: result.platformPostId,
          attempt: 1,
        });
      }
    } catch (error) {
      console.error(`Error publishing post ${postId}:`, error);

      // Check if error is retryable
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable || job.attemptsMade >= (job.opts.attempts || 5)) {
        // Mark post as failed
        await supabaseAdmin
          .from("posts")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", postId);
      }

      throw error;
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("temporary") ||
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("server error") ||
        message.includes("service unavailable")
      );
    }
    return false;
  }

  private setupEventHandlers() {
    this.worker.on("completed", (job) => {
      console.log(`Post publisher job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Post publisher job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err) => {
      console.error("Post publisher worker error:", err);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`Post publisher job ${jobId} stalled`);
    });
  }

  async start() {
    console.log("Starting post publisher worker...");
    await this.worker.waitUntilReady();
    console.log("Post publisher worker started");
  }

  async stop() {
    console.log("Stopping post publisher worker...");
    await this.worker.close();
    console.log("Post publisher worker stopped");
  }

  getWorker() {
    return this.worker;
  }
}
