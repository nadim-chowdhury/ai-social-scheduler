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
      console.error("Instagram OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=oauth_failed&platform=instagram`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_callback&platform=instagram`
      );
    }

    // Parse and validate state
    const stateData = TokenManager.parseState(state);
    if (!stateData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state&platform=instagram`
      );
    }

    const { workspaceId, userId } = stateData;

    // Verify OAuth attempt
    const { data: attempt } = await supabaseAdmin
      .from("oauth_attempts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!attempt) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=expired_attempt&platform=instagram`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://graph.facebook.com/v18.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/callback/instagram`,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, user_id } = tokenData;

    // Exchange short-lived token for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${access_token}`
    );

    if (!longLivedResponse.ok) {
      throw new Error("Failed to get long-lived token");
    }

    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token;
    const tokenExpiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 60 * 24 * 60 * 60) * 1000
    ).toISOString();

    // Get Instagram account info
    const accountResponse = await fetch(
      `https://graph.facebook.com/v18.0/${user_id}?fields=id,username,account_type,media_count&access_token=${longLivedToken}`
    );

    if (!accountResponse.ok) {
      throw new Error("Failed to fetch Instagram account info");
    }

    const accountData = await accountResponse.json();

    // Save Instagram account
    const { data: account, error: saveError } = await supabaseAdmin
      .from("social_accounts")
      .upsert({
        workspace_id: workspaceId,
        platform: "instagram",
        platform_user_id: accountData.id,
        platform_username: accountData.username,
        name: `@${accountData.username}`,
        access_token: TokenManager.encrypt(longLivedToken),
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
      `${process.env.NEXTAUTH_URL}/dashboard/settings?success=instagram_connected&account=${accountData.username}`
    );
  } catch (error) {
    console.error("Instagram callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=callback_failed&platform=instagram`
    );
  }
}
