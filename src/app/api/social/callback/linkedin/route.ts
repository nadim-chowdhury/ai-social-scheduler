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
      console.error("LinkedIn OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=oauth_failed&platform=linkedin`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_callback&platform=linkedin`
      );
    }

    // Parse and validate state
    const stateData = TokenManager.parseState(state);
    if (!stateData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state&platform=linkedin`
      );
    }

    const { workspaceId, userId } = stateData;

    // Verify OAuth attempt
    const { data: attempt } = await supabaseAdmin
      .from("oauth_attempts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("platform", "linkedin")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!attempt) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=expired_attempt&platform=linkedin`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/callback/linkedin`,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString();

    // Get LinkedIn user info
    const userResponse = await fetch("https://api.linkedin.com/v2/people/~", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch LinkedIn user info");
    }

    const userData = await userResponse.json();

    // Save LinkedIn account
    const { data: account, error: saveError } = await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          platform: "linkedin",
          platform_user_id: userData.id,
          platform_username: userData.vanityName || userData.id,
          name: `${userData.firstName?.localized?.en_US || ""} ${
            userData.lastName?.localized?.en_US || ""
          }`.trim(),
          access_token: TokenManager.encrypt(access_token),
          token_expires_at: tokenExpiresAt,
          is_active: true,
        },
        {
          onConflict: "workspace_id,platform,platform_user_id",
        }
      )
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    // Clean up OAuth attempt
    await supabaseAdmin.from("oauth_attempts").delete().eq("id", attempt.id);

    return NextResponse.redirect(
      `${
        process.env.NEXTAUTH_URL
      }/dashboard/settings?success=linkedin_connected&account=${
        userData.vanityName || userData.id
      }`
    );
  } catch (error) {
    console.error("LinkedIn callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=callback_failed&platform=linkedin`
    );
  }
}
