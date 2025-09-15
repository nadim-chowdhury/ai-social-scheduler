import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PostScheduler } from "@/lib/scheduler";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId, scheduledAt, publishNow = false } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: "Missing required field: postId" },
        { status: 400 }
      );
    }

    // Verify post exists and user has access
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select(
        `
        id,
        workspace_id,
        social_account_id,
        status,
        content_text,
        media_urls,
        platform
      `
      )
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if post is in a schedulable state
    if (post.status !== "draft" && post.status !== "scheduled") {
      return NextResponse.json(
        { error: "Post must be in draft or scheduled status to be scheduled" },
        { status: 400 }
      );
    }

    let result;

    if (publishNow) {
      // Publish immediately
      result = await PostScheduler.publishNow(postId);
    } else if (scheduledAt) {
      // Schedule for later
      result = await PostScheduler.schedulePost(
        postId,
        post.workspace_id,
        post.social_account_id,
        new Date(scheduledAt)
      );
    } else {
      return NextResponse.json(
        { error: "Either scheduledAt or publishNow must be provided" },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        status: publishNow ? "publishing" : "scheduled",
        scheduledAt: publishNow ? null : scheduledAt,
        message: publishNow
          ? "Post queued for immediate publishing"
          : "Post scheduled successfully",
      },
    });
  } catch (error) {
    console.error("Schedule post error:", error);
    return NextResponse.json(
      { error: "Failed to schedule post" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing required parameter: workspaceId" },
        { status: 400 }
      );
    }

    // Get scheduled posts
    const result = await PostScheduler.getScheduledPosts(workspaceId, limit);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }
}
