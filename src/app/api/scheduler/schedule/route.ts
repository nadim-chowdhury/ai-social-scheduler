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

    const { postId, scheduledAt } = await request.json();

    if (!postId || !scheduledAt) {
      return NextResponse.json(
        { error: "Missing required fields: postId, scheduledAt" },
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
        status
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

    // Schedule the post
    const result = await PostScheduler.schedulePost(
      postId,
      post.workspace_id,
      post.social_account_id,
      new Date(scheduledAt)
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        scheduledAt,
        message: "Post scheduled successfully",
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId, newScheduledAt } = await request.json();

    if (!postId || !newScheduledAt) {
      return NextResponse.json(
        { error: "Missing required fields: postId, newScheduledAt" },
        { status: 400 }
      );
    }

    // Reschedule the post
    const result = await PostScheduler.reschedulePost(
      postId,
      new Date(newScheduledAt)
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        newScheduledAt,
        message: "Post rescheduled successfully",
      },
    });
  } catch (error) {
    console.error("Reschedule post error:", error);
    return NextResponse.json(
      { error: "Failed to reschedule post" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Missing required parameter: postId" },
        { status: 400 }
      );
    }

    // Cancel the scheduled post
    const result = await PostScheduler.cancelScheduledPost(postId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        message: "Post scheduling cancelled successfully",
      },
    });
  } catch (error) {
    console.error("Cancel scheduled post error:", error);
    return NextResponse.json(
      { error: "Failed to cancel scheduled post" },
      { status: 500 }
    );
  }
}
