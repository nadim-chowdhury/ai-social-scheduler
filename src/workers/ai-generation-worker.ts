import { Worker, Job } from "bullmq";
import { QUEUE_NAMES, AIGenerationJob } from "@/lib/queue";
import { supabaseAdmin } from "@/lib/supabase";
import { aiService } from "@/lib/ai-providers";

export class AIGenerationWorker {
  private worker: Worker<AIGenerationJob>;

  constructor() {
    this.worker = new Worker<AIGenerationJob>(
      QUEUE_NAMES.AI_GENERATION,
      this.processJob.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 2, // Lower concurrency for AI generation
        removeOnComplete: 50,
        removeOnFail: 25,
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<AIGenerationJob>) {
    const { requestId, workspaceId, type, prompt, provider } = job.data;

    console.log(`Processing AI generation job ${requestId} for ${type}`);

    try {
      // Check workspace AI credits
      const { data: workspace } = await supabaseAdmin
        .from("workspaces")
        .select("ai_credits_used, ai_credits_limit")
        .eq("id", workspaceId)
        .single();

      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (workspace.ai_credits_used >= workspace.ai_credits_limit) {
        throw new Error("AI credits limit reached");
      }

      // Generate content using AI service
      let result;
      if (type === "text") {
        result = await aiService.generateText(prompt, provider);
      } else if (type === "image") {
        result = await aiService.generateImage(prompt, provider);
      } else {
        throw new Error(`Unsupported generation type: ${type}`);
      }

      // Update AI request record
      await supabaseAdmin
        .from("ai_requests")
        .update({
          status: "completed",
          provider: result.provider,
          cost: result.cost,
          response: result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      // Update workspace AI credits
      await supabaseAdmin
        .from("workspaces")
        .update({
          ai_credits_used: workspace.ai_credits_used + 1,
        })
        .eq("id", workspaceId);

      console.log(`AI generation job ${requestId} completed successfully`);
    } catch (error) {
      console.error(`Error processing AI generation job ${requestId}:`, error);

      // Update AI request record with error
      await supabaseAdmin
        .from("ai_requests")
        .update({
          status: "failed",
          response: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      throw error;
    }
  }

  private setupEventHandlers() {
    this.worker.on("completed", (job) => {
      console.log(`AI generation job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`AI generation job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err) => {
      console.error("AI generation worker error:", err);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`AI generation job ${jobId} stalled`);
    });
  }

  async start() {
    console.log("Starting AI generation worker...");
    await this.worker.waitUntilReady();
    console.log("AI generation worker started");
  }

  async stop() {
    console.log("Stopping AI generation worker...");
    await this.worker.close();
    console.log("AI generation worker stopped");
  }

  getWorker() {
    return this.worker;
  }
}
