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
      console.error("Twitter OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=oauth_failed&platform=twitter`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_callback&platform=twitter`
      );
    }

    // Parse and validate state
    const stateData = TokenManager.parseState(state);
    if (!stateData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state&platform=twitter`
      );
    }

    const { workspaceId, userId } = stateData;

    // Verify OAuth attempt
    const { data: attempt } = await supabaseAdmin
      .from("oauth_attempts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("platform", "twitter")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!attempt) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=expired_attempt&platform=twitter`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/callback/twitter`,
        code_verifier: "your-code-verifier", // This should be stored and retrieved
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 7200) * 1000
    ).toISOString();

    // Get Twitter user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch Twitter user info");
    }

    const userData = await userResponse.json();
    const user = userData.data;

    // Save Twitter account
    const { data: account, error: saveError } = await supabaseAdmin
      .from("social_accounts")
      .upsert({
        workspace_id: workspaceId,
        platform: "twitter",
        platform_user_id: user.id,
        platform_username: user.username,
        name: user.name,
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
      `${process.env.NEXTAUTH_URL}/dashboard/settings?success=twitter_connected&account=${user.username}`
    );
  } catch (error) {
    console.error("Twitter callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=callback_failed&platform=twitter`
    );
  }
}