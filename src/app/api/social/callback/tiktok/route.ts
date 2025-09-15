import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("TikTok OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=oauth_failed&platform=tiktok`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_callback&platform=tiktok`
      );
    }

    // Parse and validate state
    const stateData = TokenManager.parseState(state);
    if (!stateData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state&platform=tiktok`
      );
    }

    const { workspaceId, userId } = stateData;

    // Verify OAuth attempt
    const { data: attempt } = await supabaseAdmin
      .from("oauth_attempts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("platform", "tiktok")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!attempt) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=expired_attempt&platform=tiktok`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/callback/tiktok`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in, refresh_token } = tokenData.data;

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString();

    // Get TikTok user info
    const userResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error("Failed to fetch TikTok user info");
    }

    const userData = await userResponse.json();
    const user = userData.data.user;

    // Save TikTok account
    const { data: account, error: saveError } = await supabaseAdmin
      .from("social_accounts")
      .upsert({
        workspace_id: workspaceId,
        platform: "tiktok",
        platform_user_id: user.open_id,
        platform_username: user.display_name,
        name: user.display_name,
        access_token: TokenManager.encrypt(access_token),
        refresh_token: refresh_token ? TokenManager.encrypt(refresh_token) : null,
        token_expires_at: tokenExpiresAt,
        is_active: true,
      }, {
        onConflict: "workspace_id,platform,platform_user_id",
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    // Clean up OAuth attempt
    await supabaseAdmin
      .from("oauth_attempts")
      .delete()
      .eq("id", attempt.id);

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?success=tiktok_connected&account=${user.display_name}`
    );
  } catch (error) {
    console.error("TikTok callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=callback_failed&platform=tiktok`
    );
  }
}