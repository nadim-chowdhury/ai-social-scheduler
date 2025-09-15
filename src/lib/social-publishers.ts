import { supabaseAdmin } from "./supabase";

export interface SocialPostData {
  content: string;
  mediaUrls?: string[];
  platformPostId?: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  platform_user_id: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  name: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  retryable?: boolean;
}

// Base publisher class with enhanced token management
abstract class BaseSocialPublisher {
  abstract platform: string;

  async publish(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult> {
    try {
      // Check and refresh token if needed
      const refreshed = await this.ensureValidToken(account);
      if (!refreshed) {
        return {
          success: false,
          error: "Invalid or expired access token",
          retryable: false,
        };
      }

      return await this.publishToPlatform(account, data);
    } catch (error) {
      console.error(`${this.platform} publish error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        retryable: this.isRetryableError(error),
      };
    }
  }

  protected async ensureValidToken(account: SocialAccount): Promise<boolean> {
    if (this.isTokenValid(account)) {
      return true;
    }

    // Attempt to refresh token
    return await this.refreshToken(account);
  }

  protected isTokenValid(account: SocialAccount): boolean {
    if (!account.token_expires_at) return true;
    // Consider token invalid 5 minutes before expiry
    return new Date(account.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000);
  }

  protected async refreshToken(account: SocialAccount): Promise<boolean> {
    try {
      // Get current tokens from database
      const { data: currentAccount } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token, refresh_token, token_expires_at")
        .eq("id", account.id)
        .single();

      if (!currentAccount) {
        return false;
      }

      let newAccessToken = currentAccount.access_token;
      let newRefreshToken = currentAccount.refresh_token;
      let newExpiresAt = currentAccount.token_expires_at;

      // Platform-specific refresh logic
      switch (account.platform) {
        case "facebook":
          // Facebook tokens are long-lived, but we can extend them
          const fbResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${currentAccount.access_token}`
          );
          
          if (fbResponse.ok) {
            const fbData = await fbResponse.json();
            newAccessToken = fbData.access_token;
            newExpiresAt = new Date(
              Date.now() + (fbData.expires_in || 60 * 24 * 60 * 60) * 1000
            ).toISOString();
          } else {
            return false;
          }
          break;

        case "twitter":
          if (currentAccount.refresh_token) {
            const twitterResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: currentAccount.refresh_token,
                client_id: process.env.TWITTER_CLIENT_ID!,
              }),
            });

            if (twitterResponse.ok) {
              const twitterData = await twitterResponse.json();
              newAccessToken = twitterData.access_token;
              newRefreshToken = twitterData.refresh_token || currentAccount.refresh_token;
              newExpiresAt = new Date(
                Date.now() + (twitterData.expires_in || 7200) * 1000
              ).toISOString();
            } else {
              return false;
            }
          } else {
            return false;
          }
          break;

        default:
          return false;
      }

      // Update database with new tokens
      const { error: updateError } = await supabaseAdmin
        .from("social_accounts")
        .update({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_expires_at: newExpiresAt,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (updateError) {
        console.error("Failed to update refreshed tokens:", updateError);
        return false;
      }

      // Update account object for current request
      account.access_token = newAccessToken;
      account.refresh_token = newRefreshToken;
      account.token_expires_at = newExpiresAt;

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  protected abstract publishToPlatform(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult>;

  protected abstract isRetryableError(error: unknown): boolean;
}

// Enhanced Facebook Publisher
export class FacebookPublisher extends BaseSocialPublisher {
  platform = "facebook";

  protected async publishToPlatform(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult> {
    const url = `https://graph.facebook.com/v18.0/${account.platform_user_id}/feed`;

    const payload: any = {
      message: data.content,
      access_token: account.access_token,
    };

    // Add media if provided
    if (data.mediaUrls && data.mediaUrls.length > 0) {
      // For production, upload images to Facebook first
      const mediaIds = [];
      for (const mediaUrl of data.mediaUrls.slice(0, 4)) { // Facebook supports up to 4 images
        try {
          const uploadResponse = await fetch(
            `https://graph.facebook.com/v18.0/${account.platform_user_id}/photos`,
            {
              method: "POST",
              body: new URLSearchParams({
                url: mediaUrl,
                access_token: account.access_token,
                published: "false", // Upload but don't publish yet
              }),
            }
          );

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            mediaIds.push(uploadData.id);
          }
        } catch (error) {
          console.error("Failed to upload media:", error);
        }
      }

      if (mediaIds.length > 0) {
        payload.attached_media = JSON.stringify(mediaIds.map(id => ({ media_fbid: id })));
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();
    return {
      success: true,
      platformPostId: result.id,
    };
  }

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("temporary") ||
        message.includes("timeout") ||
        message.includes("network")
      );
    }
    return false;
  }
}

// Enhanced Instagram Publisher
export class InstagramPublisher extends BaseSocialPublisher {
  platform = "instagram";

  protected async publishToPlatform(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult> {
    // Instagram requires a two-step process:
    // 1. Create media container
    // 2. Publish the container

    if (!data.mediaUrls || data.mediaUrls.length === 0) {
      throw new Error("Instagram requires at least one media file");
    }

    // Step 1: Create media container
    const containerUrl = `https://graph.facebook.com/v18.0/${account.platform_user_id}/media`;

    const containerPayload = {
      image_url: data.mediaUrls[0],
      caption: data.content,
      access_token: account.access_token,
    };

    const containerResponse = await fetch(containerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(containerPayload),
    });

    if (!containerResponse.ok) {
      const errorData = await containerResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `Container creation failed: ${containerResponse.statusText}`
      );
    }

    const containerResult = await containerResponse.json();
    const containerId = containerResult.id;

    // Step 2: Publish the container
    const publishUrl = `https://graph.facebook.com/v18.0/${account.platform_user_id}/media_publish`;

    const publishPayload = {
      creation_id: containerId,
      access_token: account.access_token,
    };

    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishPayload),
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `Publish failed: ${publishResponse.statusText}`
      );
    }

    const publishResult = await publishResponse.json();
    return {
      success: true,
      platformPostId: publishResult.id,
    };
  }

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("temporary") ||
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("processing")
      );
    }
    return false;
  }
}

// Enhanced Twitter Publisher
export class TwitterPublisher extends BaseSocialPublisher {
  platform = "twitter";

  protected async publishToPlatform(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult> {
    // Twitter API v2 implementation
    const url = "https://api.twitter.com/2/tweets";

    const payload: any = {
      text: data.content,
    };

    // Add media if provided
    if (data.mediaUrls && data.mediaUrls.length > 0) {
      // For production, upload media to Twitter first
      const mediaIds = [];
      for (const mediaUrl of data.mediaUrls.slice(0, 4)) { // Twitter supports up to 4 images
        try {
          // Upload media to Twitter
          const uploadResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
            body: new URLSearchParams({
              media_data: mediaUrl, // This should be base64 encoded image data
            }),
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            mediaIds.push(uploadData.media_id_string);
          }
        } catch (error) {
          console.error("Failed to upload media:", error);
        }
      }

      if (mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();
    return {
      success: true,
      platformPostId: result.data.id,
    };
  }

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("temporary") ||
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("server error")
      );
    }
    return false;
  }
}

// Publisher factory
export class SocialPublisherFactory {
  private static publishers = new Map([
    ["facebook", new FacebookPublisher()],
    ["instagram", new InstagramPublisher()],
    ["twitter", new TwitterPublisher()],
  ]);

  static getPublisher(platform: string): BaseSocialPublisher | null {
    return this.publishers.get(platform) || null;
  }

  static async publishPost(
    account: SocialAccount,
    data: SocialPostData
  ): Promise<PublishResult> {
    const publisher = this.getPublisher(account.platform);
    if (!publisher) {
      return {
        success: false,
        error: `Unsupported platform: ${account.platform}`,
        retryable: false,
      };
    }

    return publisher.publish(account, data);
  }
}

// Helper function to get social account from database
export async function getSocialAccount(
  accountId: string
): Promise<SocialAccount | null> {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.error("Failed to fetch social account:", error);
    return null;
  }

  return {
    id: data.id,
    platform: data.platform,
    platform_user_id: data.platform_user_id,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: data.token_expires_at,
    name: data.name,
  };
}
