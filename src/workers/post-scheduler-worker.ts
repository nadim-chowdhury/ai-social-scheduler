import { Worker, Job } from "bullmq";
import {
  QUEUE_NAMES,
  PostSchedulerJob,
  addPostPublisherJob,
} from "@/lib/queue";
import { supabaseAdmin } from "@/lib/supabase";

export class PostSchedulerWorker {
  private worker: Worker<PostSchedulerJob>;

  constructor() {
    this.worker = new Worker<PostSchedulerJob>(
      QUEUE_NAMES.POST_SCHEDULER,
      this.processJob.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 5,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<PostSchedulerJob>) {
    const { postId, workspaceId, socialAccountId, scheduledAt } = job.data;

    console.log(`Processing post scheduler job for post ${postId}`);

    try {
      // Check if post is still scheduled and not already processed
      const { data: post, error: postError } = await supabaseAdmin
        .from("posts")
        .select("*")
        .eq("id", postId)
        .eq("status", "scheduled")
        .single();

      if (postError || !post) {
        console.log(`Post ${postId} not found or not scheduled, skipping`);
        return;
      }

      // Check if it's time to publish
      const scheduledTime = new Date(scheduledAt);
      const now = new Date();

      if (scheduledTime > now) {
        // Not time yet, reschedule for later
        const delay = scheduledTime.getTime() - now.getTime();
        console.log(
          `Post ${postId} scheduled for later, rescheduling in ${delay}ms`
        );

        await addPostSchedulerJob(job.data, delay);
        return;
      }

      // Time to publish! Move to publisher queue
      console.log(`Post ${postId} ready to publish, moving to publisher queue`);

      await addPostPublisherJob({
        postId,
        workspaceId,
        socialAccountId,
        platform: post.platform,
        content: post.content_text || "",
        mediaUrls: post.media_urls || [],
        attempt: 1,
      });

      // Update post status to 'posting'
      await supabaseAdmin
        .from("posts")
        .update({
          status: "posting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      console.log(`Post ${postId} moved to publisher queue successfully`);
    } catch (error) {
      console.error(
        `Error processing post scheduler job for ${postId}:`,
        error
      );

      // Update post status to failed if this is the final attempt
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
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

  private setupEventHandlers() {
    this.worker.on("completed", (job) => {
      console.log(`Post scheduler job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Post scheduler job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err) => {
      console.error("Post scheduler worker error:", err);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`Post scheduler job ${jobId} stalled`);
    });
  }

  async start() {
    console.log("Starting post scheduler worker...");
    await this.worker.waitUntilReady();
    console.log("Post scheduler worker started");
  }

  async stop() {
    console.log("Stopping post scheduler worker...");
    await this.worker.close();
    console.log("Post scheduler worker stopped");
  }

  getWorker() {
    return this.worker;
  }
}
