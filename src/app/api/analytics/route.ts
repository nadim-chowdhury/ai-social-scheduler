import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const analyticsQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  postId: z.string().uuid().optional(),
  platform: z
    .enum(["facebook", "instagram", "twitter", "linkedin", "tiktok"])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(["day", "week", "month", "platform", "post"]).default("day"),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/analytics - Get analytics data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      workspaceId: searchParams.get("workspaceId"),
      postId: searchParams.get("postId"),
      platform: searchParams.get("platform"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      groupBy: searchParams.get("groupBy"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
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

    // Build base query
    let baseQuery = supabaseAdmin
      .from("analytics")
      .select(
        `
        id,
        post_id,
        impressions,
        clicks,
        likes,
        comments,
        shares,
        saves,
        engagement_rate,
        fetched_at,
        posts!inner(
          id,
          platform,
          content_text,
          posted_at,
          social_accounts!inner(
            name,
            platform_username
          )
        )
      `
      )
      .eq("posts.workspace_id", query.workspaceId);

    // Apply filters
    if (query.postId) {
      baseQuery = baseQuery.eq("post_id", query.postId);
    }

    if (query.platform) {
      baseQuery = baseQuery.eq("posts.platform", query.platform);
    }

    if (query.startDate) {
      baseQuery = baseQuery.gte("fetched_at", query.startDate);
    }

    if (query.endDate) {
      baseQuery = baseQuery.lte("fetched_at", query.endDate);
    }

    // Get analytics data
    const { data: analytics, error: analyticsError } = await baseQuery
      .order("fetched_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (analyticsError) {
      throw analyticsError;
    }

    // Calculate aggregated metrics
    const aggregatedMetrics = calculateAggregatedMetrics(analytics || []);

    // Group data based on groupBy parameter
    const groupedData = groupAnalyticsData(analytics || [], query.groupBy);

    return NextResponse.json({
      success: true,
      data: {
        analytics: groupedData,
        metrics: aggregatedMetrics,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: analytics?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// Helper function to calculate aggregated metrics
function calculateAggregatedMetrics(analytics: any[]) {
  const totals = analytics.reduce(
    (acc, item) => ({
      impressions: acc.impressions + (item.impressions || 0),
      clicks: acc.clicks + (item.clicks || 0),
      likes: acc.likes + (item.likes || 0),
      comments: acc.comments + (item.comments || 0),
      shares: acc.shares + (item.shares || 0),
      saves: acc.saves + (item.saves || 0),
    }),
    {
      impressions: 0,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    }
  );

  const totalEngagement =
    totals.likes + totals.comments + totals.shares + totals.saves;
  const engagementRate =
    totals.impressions > 0 ? (totalEngagement / totals.impressions) * 100 : 0;
  const clickThroughRate =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return {
    ...totals,
    engagementRate: Math.round(engagementRate * 100) / 100,
    clickThroughRate: Math.round(clickThroughRate * 100) / 100,
    totalEngagement,
  };
}

// Helper function to group analytics data
function groupAnalyticsData(analytics: any[], groupBy: string) {
  if (groupBy === "post") {
    return analytics;
  }

  const grouped: { [key: string]: any } = {};

  analytics.forEach((item) => {
    let key: string;

    switch (groupBy) {
      case "day":
        key = new Date(item.fetched_at).toISOString().split("T")[0];
        break;
      case "week":
        const weekStart = new Date(item.fetched_at);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      case "month":
        const month = new Date(item.fetched_at);
        key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        break;
      case "platform":
        key = item.posts.platform;
        break;
      default:
        key = "all";
    }

    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        impressions: 0,
        clicks: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        posts: 0,
      };
    }

    grouped[key].impressions += item.impressions || 0;
    grouped[key].clicks += item.clicks || 0;
    grouped[key].likes += item.likes || 0;
    grouped[key].comments += item.comments || 0;
    grouped[key].shares += item.shares || 0;
    grouped[key].saves += item.saves || 0;
    grouped[key].posts += 1;
  });

  // Calculate engagement rates for each group
  Object.values(grouped).forEach((group: any) => {
    const totalEngagement =
      group.likes + group.comments + group.shares + group.saves;
    group.engagementRate =
      group.impressions > 0
        ? Math.round((totalEngagement / group.impressions) * 10000) / 100
        : 0;
    group.clickThroughRate =
      group.impressions > 0
        ? Math.round((group.clicks / group.impressions) * 10000) / 100
        : 0;
    group.totalEngagement = totalEngagement;
  });

  return Object.values(grouped).sort(
    (a: any, b: any) =>
      new Date(b.period).getTime() - new Date(a.period).getTime()
  );
}
