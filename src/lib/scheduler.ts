import { addPostSchedulerJob, addAIGenerationJob } from "./queue";
import { supabaseAdmin } from "./supabase";

export class PostScheduler {
  /**
   * Schedule a post for publishing
   */
  static async schedulePost(
    postId: string,
    workspaceId: string,
    socialAccountId: string,
    scheduledAt: Date
  ) {
    try {
      // Calculate delay until scheduled time
      const now = new Date();
      const delay = Math.max(0, scheduledAt.getTime() - now.getTime());

      // Add job to scheduler queue
      await addPostSchedulerJob(
        {
          postId,
          workspaceId,
          socialAccountId,
          scheduledAt: scheduledAt.toISOString(),
          attempt: 1,
        },
        delay
      );

      // Update post status in database
      await supabaseAdmin
        .from("posts")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      console.log(`Post ${postId} scheduled for ${scheduledAt.toISOString()}`);
      return { success: true };
    } catch (error) {
      console.error("Error scheduling post:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel a scheduled post
   */
  static async cancelScheduledPost(postId: string) {
    try {
      // Update post status to draft
      await supabaseAdmin
        .from("posts")
        .update({
          status: "draft",
          scheduled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      // Note: In a production system, you'd also want to remove the job from the queue
      // This would require storing job IDs in the database or using a different approach

      console.log(`Post ${postId} scheduling cancelled`);
      return { success: true };
    } catch (error) {
      console.error("Error cancelling scheduled post:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Reschedule a post
   */
  static async reschedulePost(postId: string, newScheduledAt: Date) {
    try {
      // Cancel existing scheduling
      await this.cancelScheduledPost(postId);

      // Get post details
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("workspace_id, social_account_id")
        .eq("id", postId)
        .single();

      if (!post) {
        throw new Error("Post not found");
      }

      // Schedule with new time
      return await this.schedulePost(
        postId,
        post.workspace_id,
        post.social_account_id,
        newScheduledAt
      );
    } catch (error) {
      console.error("Error rescheduling post:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Publish a post immediately
   */
  static async publishNow(postId: string) {
    try {
      // Get post details
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select(
          "workspace_id, social_account_id, platform, content_text, media_urls"
        )
        .eq("id", postId)
        .single();

      if (!post) {
        throw new Error("Post not found");
      }

      // Update status to posting
      await supabaseAdmin
        .from("posts")
        .update({
          status: "posting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      // Add to publisher queue immediately
      const { addPostPublisherJob } = await import("./queue");
      await addPostPublisherJob({
        postId,
        workspaceId: post.workspace_id,
        socialAccountId: post.social_account_id,
        platform: post.platform,
        content: post.content_text || "",
        mediaUrls: post.media_urls || [],
        attempt: 1,
      });

      console.log(`Post ${postId} queued for immediate publishing`);
      return { success: true };
    } catch (error) {
      console.error("Error publishing post immediately:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get scheduled posts for a workspace
   */
  static async getScheduledPosts(workspaceId: string, limit = 50) {
    try {
      const { data: posts, error } = await supabaseAdmin
        .from("posts")
        .select(
          `
          id,
          content_text,
          platform,
          scheduled_at,
          status,
          created_at,
          social_accounts!inner(name, platform_username)
        `
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return { success: true, data: posts };
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get posts due for publishing (for manual processing)
   */
  static async getDuePosts(workspaceId?: string) {
    try {
      let query = supabaseAdmin
        .from("posts")
        .select(
          `
          id,
          workspace_id,
          social_account_id,
          platform,
          content_text,
          media_urls,
          scheduled_at
        `
        )
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });

      if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
      }

      const { data: posts, error } = await query;

      if (error) {
        throw error;
      }

      return { success: true, data: posts };
    } catch (error) {
      console.error("Error fetching due posts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export class AIScheduler {
  /**
   * Queue AI generation job
   */
  static async queueAIGeneration(
    requestId: string,
    workspaceId: string,
    type: "text" | "image",
    prompt: string,
    provider?: string
  ) {
    try {
      await addAIGenerationJob({
        requestId,
        workspaceId,
        type,
        prompt,
        provider,
        attempt: 1,
      });

      console.log(`AI generation job queued: ${requestId}`);
      return { success: true };
    } catch (error) {
      console.error("Error queuing AI generation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
