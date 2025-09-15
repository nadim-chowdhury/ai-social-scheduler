import { Worker, Job } from "bullmq";
import { QUEUE_NAMES, AnalyticsSyncJob } from "@/lib/queue";
import { supabaseAdmin } from "@/lib/supabase";

export class AnalyticsSyncWorker {
  private worker: Worker<AnalyticsSyncJob>;

  constructor() {
    this.worker = new Worker<AnalyticsSyncJob>(
      QUEUE_NAMES.ANALYTICS_SYNC,
      this.processJob.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 2, // Lower concurrency for analytics
        removeOnComplete: 200,
        removeOnFail: 100,
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<AnalyticsSyncJob>) {
    const { postId, platform, platformPostId } = job.data;

    console.log(`Syncing analytics for post ${postId} on ${platform}`);

    try {
      // Get analytics data from platform
      const analytics = await this.fetchPlatformAnalytics(
        platform,
        platformPostId
      );

      if (!analytics) {
        console.log(`No analytics data available for post ${postId}`);
        return;
      }

      // Store analytics in database
      await supabaseAdmin.from("analytics").upsert({
        post_id: postId,
        impressions: analytics.impressions || 0,
        clicks: analytics.clicks || 0,
        likes: analytics.likes || 0,
        comments: analytics.comments || 0,
        shares: analytics.shares || 0,
        saves: analytics.saves || 0,
        engagement_rate: analytics.engagement_rate || 0,
        fetched_at: new Date().toISOString(),
      });

      console.log(`Analytics synced for post ${postId}:`, analytics);
    } catch (error) {
      console.error(`Error syncing analytics for post ${postId}:`, error);
      throw error;
    }
  }

  private async fetchPlatformAnalytics(
    platform: string,
    platformPostId: string
  ): Promise<any> {
    switch (platform) {
      case "facebook":
        return this.fetchFacebookAnalytics(platformPostId);
      case "instagram":
        return this.fetchInstagramAnalytics(platformPostId);
      case "twitter":
        return this.fetchTwitterAnalytics(platformPostId);
      case "linkedin":
        return this.fetchLinkedInAnalytics(platformPostId);
      default:
        console.warn(`Analytics not supported for platform: ${platform}`);
        return null;
    }
  }

  private async fetchFacebookAnalytics(postId: string): Promise<any> {
    try {
      // Get access token from any active Facebook account
      const { data: account } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token")
        .eq("platform", "facebook")
        .eq("is_active", true)
        .single();

      if (!account) {
        throw new Error("No active Facebook account found");
      }

      const url = `https://graph.facebook.com/v18.0/${postId}/insights?metric=post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total&access_token=${account.access_token}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      const insights = data.data || [];

      const analytics: any = {};
      insights.forEach((insight: any) => {
        switch (insight.name) {
          case "post_impressions":
            analytics.impressions = insight.values[0]?.value || 0;
            break;
          case "post_engaged_users":
            analytics.engagement = insight.values[0]?.value || 0;
            break;
          case "post_clicks":
            analytics.clicks = insight.values[0]?.value || 0;
            break;
          case "post_reactions_by_type_total":
            analytics.likes = insight.values[0]?.value?.total || 0;
            break;
        }
      });

      return analytics;
    } catch (error) {
      console.error("Facebook analytics fetch error:", error);
      return null;
    }
  }

  private async fetchInstagramAnalytics(postId: string): Promise<any> {
    try {
      // Get access token from any active Instagram account
      const { data: account } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token")
        .eq("platform", "instagram")
        .eq("is_active", true)
        .single();

      if (!account) {
        throw new Error("No active Instagram account found");
      }

      const url = `https://graph.facebook.com/v18.0/${postId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${account.access_token}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.statusText}`);
      }

      const data = await response.json();
      const insights = data.data || [];

      const analytics: any = {};
      insights.forEach((insight: any) => {
        const value = insight.values[0]?.value || 0;
        switch (insight.name) {
          case "impressions":
            analytics.impressions = value;
            break;
          case "reach":
            analytics.reach = value;
            break;
          case "likes":
            analytics.likes = value;
            break;
          case "comments":
            analytics.comments = value;
            break;
          case "shares":
            analytics.shares = value;
            break;
          case "saved":
            analytics.saves = value;
            break;
        }
      });

      return analytics;
    } catch (error) {
      console.error("Instagram analytics fetch error:", error);
      return null;
    }
  }

  private async fetchTwitterAnalytics(postId: string): Promise<any> {
    try {
      // Get access token from any active Twitter account
      const { data: account } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token")
        .eq("platform", "twitter")
        .eq("is_active", true)
        .single();

      if (!account) {
        throw new Error("No active Twitter account found");
      }

      const url = `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.statusText}`);
      }

      const data = await response.json();
      const metrics = data.data?.public_metrics || {};

      return {
        impressions: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: metrics.retweet_count || 0,
      };
    } catch (error) {
      console.error("Twitter analytics fetch error:", error);
      return null;
    }
  }

  private async fetchLinkedInAnalytics(postId: string): Promise<any> {
    try {
      // Get access token from any active LinkedIn account
      const { data: account } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token")
        .eq("platform", "linkedin")
        .eq("is_active", true)
        .single();

      if (!account) {
        throw new Error("No active LinkedIn account found");
      }

      const url = `https://api.linkedin.com/v2/socialActions/${postId}/statistics`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        impressions: data.numViews || 0,
        likes: data.numLikes || 0,
        comments: data.numComments || 0,
        shares: data.numShares || 0,
      };
    } catch (error) {
      console.error("LinkedIn analytics fetch error:", error);
      return null;
    }
  }

  private setupEventHandlers() {
    this.worker.on("completed", (job) => {
      console.log(`Analytics sync job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Analytics sync job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err) => {
      console.error("Analytics sync worker error:", err);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`Analytics sync job ${jobId} stalled`);
    });
  }

  async start() {
    console.log("Starting analytics sync worker...");
    await this.worker.waitUntilReady();
    console.log("Analytics sync worker started");
  }

  async stop() {
    console.log("Stopping analytics sync worker...");
    await this.worker.close();
    console.log("Analytics sync worker stopped");
  }

  getWorker() {
    return this.worker;
  }
}
