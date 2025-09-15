import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

// Validation schemas
const createPostSchema = z.object({
  workspaceId: z.string().uuid(),
  platform: z.enum(["facebook", "instagram", "twitter", "linkedin", "tiktok"]),
  socialAccountId: z.string().uuid(),
  contentText: z.string().min(1).max(2000),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().optional().default("UTC"),
  meta: z.record(z.any()).optional().default({}),
});

const updatePostSchema = createPostSchema.partial().extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  workspaceId: z.string().uuid(),
  status: z
    .enum(["draft", "scheduled", "posting", "posted", "failed"])
    .optional(),
  platform: z
    .enum(["facebook", "instagram", "twitter", "linkedin", "tiktok"])
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  sortBy: z
    .enum(["created_at", "scheduled_at", "posted_at", "updated_at"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// GET /api/posts - List posts with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      workspaceId: searchParams.get("workspaceId"),
      status: searchParams.get("status"),
      platform: searchParams.get("platform"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      search: searchParams.get("search"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", query.workspaceId)
      .eq("owner_id", session.user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Build query
    let dbQuery = supabaseAdmin
      .from("posts")
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
      .eq("workspace_id", query.workspaceId);

    // Apply filters
    if (query.status) {
      dbQuery = dbQuery.eq("status", query.status);
    }

    if (query.platform) {
      dbQuery = dbQuery.eq("platform", query.platform);
    }

    if (query.search) {
      dbQuery = dbQuery.or(
        `content_text.ilike.%${query.search}%,meta->>title.ilike.%${query.search}%`
      );
    }

    // Apply sorting
    dbQuery = dbQuery.order(query.sortBy, {
      ascending: query.sortOrder === "asc",
    });

    // Apply pagination
    dbQuery = dbQuery.range(query.offset, query.offset + query.limit - 1);

    const { data: posts, error: postsError, count } = await dbQuery;

    if (postsError) {
      throw postsError;
    }

    return NextResponse.json({
      success: true,
      data: {
        posts: posts || [],
        pagination: {
          total: count || 0,
          limit: query.limit,
          offset: query.offset,
          hasMore: (count || 0) > query.offset + query.limit,
        },
      },
    });
  } catch (error) {
    console.error("Get posts error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", validatedData.workspaceId)
      .eq("owner_id", session.user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Verify social account exists and belongs to workspace
    const { data: socialAccount, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select("id, platform")
      .eq("id", validatedData.socialAccountId)
      .eq("workspace_id", validatedData.workspaceId)
      .eq("is_active", true)
      .single();

    if (accountError || !socialAccount) {
      return NextResponse.json(
        { error: "Social account not found" },
        { status: 404 }
      );
    }

    // Verify platform matches
    if (socialAccount.platform !== validatedData.platform) {
      return NextResponse.json(
        { error: "Platform mismatch with social account" },
        { status: 400 }
      );
    }

    // Create post
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .insert({
        workspace_id: validatedData.workspaceId,
        created_by: session.user.id,
        platform: validatedData.platform,
        social_account_id: validatedData.socialAccountId,
        content_text: validatedData.contentText,
        media_urls: validatedData.mediaUrls,
        scheduled_at: validatedData.scheduledAt || null,
        timezone: validatedData.timezone,
        status: validatedData.scheduledAt ? "scheduled" : "draft",
        meta: validatedData.meta,
      })
      .select(
        `
        id,
        platform,
        content_text,
        media_urls,
        scheduled_at,
        timezone,
        status,
        meta,
        created_at,
        updated_at,
        social_accounts!inner(
          id,
          name,
          platform_username,
          platform
        )
      `
      )
      .single();

    if (postError) {
      throw postError;
    }

    return NextResponse.json({
      success: true,
      data: post,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Create post error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid post data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
