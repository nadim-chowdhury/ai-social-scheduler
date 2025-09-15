import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserWorkspaceAccess } from "@/lib/auth";
import { TokenManager } from "@/lib/token-manager";

// POST /api/social/accounts/[id]/refresh - Refresh access token
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Get social account with encrypted tokens
    const { data: account, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select("*, workspaces!inner(id)")
      .eq("id", id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Social account not found" },
        { status: 404 }
      );
    }

    // Check workspace access
    const userRole = await getUserWorkspaceAccess(session.user.id, account.workspaces.id);
    if (!userRole) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Decrypt tokens
    const accessToken = TokenManager.decrypt(account.access_token);
    const refreshToken = account.refresh_token ? TokenManager.decrypt(account.refresh_token) : null;

    let newAccessToken = accessToken;
    let newRefreshToken = refreshToken;
    let newExpiresAt = account.token_expires_at;

    // Platform-specific token refresh logic
    switch (account.platform) {
      case "facebook":
        // Facebook tokens are long-lived, but we can extend them
        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${accessToken}`
        );
        
        if (fbResponse.ok) {
          const fbData = await fbResponse.json();
          newAccessToken = fbData.access_token;
          newExpiresAt = new Date(
            Date.now() + (fbData.expires_in || 60 * 24 * 60 * 60) * 1000
          ).toISOString();
        }
        break;

      case "twitter":
        if (refreshToken) {
          const twitterResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: process.env.TWITTER_CLIENT_ID!,
            }),
          });

          if (twitterResponse.ok) {
            const twitterData = await twitterResponse.json();
            newAccessToken = twitterData.access_token;
            newRefreshToken = twitterData.refresh_token || refreshToken;
            newExpiresAt = new Date(
              Date.now() + (twitterData.expires_in || 7200) * 1000
            ).toISOString();
          }
        }
        break;

      case "linkedin":
        if (refreshToken) {
          const linkedinResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: process.env.LINKEDIN_CLIENT_ID!,
              client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
            }),
          });

          if (linkedinResponse.ok) {
            const linkedinData = await linkedinResponse.json();
            newAccessToken = linkedinData.access_token;
            newRefreshToken = linkedinData.refresh_token || refreshToken;
            newExpiresAt = new Date(
              Date.now() + (linkedinData.expires_in || 3600) * 1000
            ).toISOString();
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: "Token refresh not supported for this platform" },
          { status: 400 }
        );
    }

    // Update account with new tokens
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        access_token: TokenManager.encrypt(newAccessToken),
        refresh_token: newRefreshToken ? TokenManager.encrypt(newRefreshToken) : null,
        token_expires_at: newExpiresAt,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        expires_at: newExpiresAt,
        expires_in: Math.floor((new Date(newExpiresAt).getTime() - Date.now()) / 1000),
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
