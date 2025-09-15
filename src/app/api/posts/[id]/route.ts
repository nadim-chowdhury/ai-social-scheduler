import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updatePostSchema = z.object({
  contentText: z.string().min(1).max(2000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/posts/[id] - Get a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = paramsSchema.parse(params);

    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select(
        `
        id,
        workspace_id,
        platform,
        content_text,
        media_urls,
        scheduled_at,
        timezone,
        status,
        platform_post_id,
        meta,
        created_at,
        updated_at,
        posted_at,
        social_accounts!inner(
          id,
          name,
          platform_username,
          platform
        ),
        analytics(
          id,
          impressions,
          clicks,
          likes,
          comments,
          shares,
          saves,
          engagement_rate,
          fetched_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", post.workspace_id)
      .eq("owner_id", session.user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error("Get post error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid post ID", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

// PUT /api/posts/[id] - Update a specific post
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = paramsSchema.parse(params);
    const body = await request.json();
    const validatedData = updatePostSchema.parse(body);

    // Get existing post and verify access
    const { data: existingPost, error: existingError } = await supabaseAdmin
      .from("posts")
      .select(
        `
        id,
        workspace_id,
        status,
        scheduled_at
      `
      )
      .eq("id", id)
      .single();

    if (existingError || !existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", existingPost.workspace_id)
      .eq("owner_id", session.user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if post can be updated
    if (existingPost.status === "posting") {
      return NextResponse.json(
        { error: "Cannot update post while it's being published" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.contentText !== undefined) {
      updateData.content_text = validatedData.contentText;
    }

    if (validatedData.mediaUrls !== undefined) {
      updateData.media_urls = validatedData.mediaUrls;
    }

    if (validatedData.scheduledAt !== undefined) {
      updateData.scheduled_at = validatedData.scheduledAt;
      // Update status based on scheduling
      if (validatedData.scheduledAt) {
        updateData.status = "scheduled";
      } else if (existingPost.status === "scheduled") {
        updateData.status = "draft";
      }
    }

    if (validatedData.timezone !== undefined) {
      updateData.timezone = validatedData.timezone;
    }

    if (validatedData.meta !== undefined) {
      updateData.meta = validatedData.meta;
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from("posts")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id,
        platform,
        content_text,
        media_urls,
        scheduled_at,
        timezone,
        status,
        platform_post_id,
        meta,
        created_at,
        updated_at,
        posted_at,
        social_accounts!inner(
          id,
          name,
          platform_username,
          platform
        )
      `
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: updatedPost,
      message: "Post updated successfully",
    });
  } catch (error) {
    console.error("Update post error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[id] - Delete a specific post
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = paramsSchema.parse(params);

    // Get existing post and verify access
    const { data: existingPost, error: existingError } = await supabaseAdmin
      .from("posts")
      .select(
        `
        id,
        workspace_id,
        status
      `
      )
      .eq("id", id)
      .single();

    if (existingError || !existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", existingPost.workspace_id)
      .eq("owner_id", session.user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if post can be deleted
    if (existingPost.status === "posting") {
      return NextResponse.json(
        { error: "Cannot delete post while it's being published" },
        { status: 400 }
      );
    }

    // Delete post (cascade will handle analytics)
    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid post ID", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
