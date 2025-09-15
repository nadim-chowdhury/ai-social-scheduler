import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";
import { z } from "zod";

const connectSchema = z.object({
  platform: z.enum([
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "youtube",
    "tiktok",
  ]),
  workspaceId: z.string().uuid(),
});

// POST /api/social/connect - Initiate OAuth connection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform, workspaceId } = connectSchema.parse(body);

    // Check workspace access
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", session.user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Generate secure state parameter
    const state = TokenManager.generateState(workspaceId, session.user.id);

    // Save OAuth attempt
    const { error: attemptError } = await supabaseAdmin
      .from("oauth_attempts")
      .insert({
        workspace_id: workspaceId,
        user_id: session.user.id,
        platform,
        state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    if (attemptError) {
      throw attemptError;
    }

    // Generate OAuth URL based on platform
    let authUrl: string;

    switch (platform) {
      case "facebook":
        authUrl =
          `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${process.env.META_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/facebook`
          )}&` +
          `scope=${encodeURIComponent(
            "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish"
          )}&` +
          `state=${state}&` +
          `response_type=code`;
        break;

      case "instagram":
        authUrl =
          `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${process.env.META_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/instagram`
          )}&` +
          `scope=${encodeURIComponent(
            "instagram_basic,instagram_content_publish"
          )}&` +
          `state=${state}&` +
          `response_type=code`;
        break;

      case "twitter":
        const codeVerifier = TokenManager.generateState(
          workspaceId,
          session.user.id
        );
        const codeChallenge = Buffer.from(codeVerifier).toString("base64url");

        // Store code verifier for later use
        await supabaseAdmin
          .from("oauth_attempts")
          .update({ code_verifier })
          .eq("state", state);

        authUrl =
          `https://twitter.com/i/oauth2/authorize?` +
          `response_type=code&` +
          `client_id=${process.env.TWITTER_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/twitter`
          )}&` +
          `scope=${encodeURIComponent(
            "tweet.read tweet.write users.read offline.access"
          )}&` +
          `state=${state}&` +
          `code_challenge=${codeChallenge}&` +
          `code_challenge_method=S256`;
        break;

      case "linkedin":
        authUrl =
          `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code&` +
          `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/linkedin`
          )}&` +
          `scope=${encodeURIComponent("w_member_social")}&` +
          `state=${state}`;
        break;

      case "youtube":
        authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/youtube`
          )}&` +
          `scope=${encodeURIComponent(
            "https://www.googleapis.com/auth/youtube.upload"
          )}&` +
          `response_type=code&` +
          `state=${state}&` +
          `access_type=offline&` +
          `prompt=consent`;
        break;

      case "tiktok":
        authUrl =
          `https://www.tiktok.com/auth/authorize/?` +
          `client_key=${process.env.TIKTOK_CLIENT_KEY}&` +
          `scope=${encodeURIComponent("user.info.basic,video.publish")}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(
            `${process.env.NEXTAUTH_URL}/api/social/callback/tiktok`
          )}&` +
          `state=${state}`;
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    console.error("Social connect error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to initiate social connection" },
      { status: 500 }
    );
  }
}
