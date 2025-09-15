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
      console.error("YouTube OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=oauth_failed&platform=youtube`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_callback&platform=youtube`
      );
    }

    // Parse and validate state
    const stateData = TokenManager.parseState(state);
    if (!stateData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state&platform=youtube`
      );
    }

    const { workspaceId, userId } = stateData;

    // Verify OAuth attempt
    const { data: attempt } = await supabaseAdmin
      .from("oauth_attempts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("platform", "youtube")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!attempt) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=expired_attempt&platform=youtube`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/callback/youtube`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString();

    // Get YouTube channel info
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!channelResponse.ok) {
      throw new Error("Failed to fetch YouTube channel info");
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      throw new Error("No YouTube channel found");
    }

    // Save YouTube account
    const { data: account, error: saveError } = await supabaseAdmin
      .from("social_accounts")
      .upsert({
        workspace_id: workspaceId,
        platform: "youtube",
        platform_user_id: channel.id,
        platform_username: channel.snippet.customUrl || channel.id,
        name: channel.snippet.title,
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
      `${process.env.NEXTAUTH_URL}/dashboard/settings?success=youtube_connected&account=${channel.snippet.title}`
    );
  } catch (error) {
    console.error("YouTube callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=callback_failed&platform=youtube`
    );
  }
}