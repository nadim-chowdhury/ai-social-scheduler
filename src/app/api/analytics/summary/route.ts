import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const summaryQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  period: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  platform: z
    .enum(["facebook", "instagram", "twitter", "linkedin", "tiktok"])
    .optional(),
});

// GET /api/analytics/summary - Get analytics summary
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = summaryQuerySchema.parse({
      workspaceId: searchParams.get("workspaceId"),
      period: searchParams.get("period"),
      platform: searchParams.get("platform"),
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

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (query.period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get current period analytics
    let currentQuery = supabaseAdmin
      .from("analytics")
      .select(
        `
        impressions,
        clicks,
        likes,
        comments,
        shares,
        saves,
        engagement_rate,
        fetched_at,
        posts!inner(
          platform,
          posted_at
        )
      `
      )
      .eq("posts.workspace_id", query.workspaceId)
      .gte("fetched_at", startDate.toISOString())
      .lte("fetched_at", endDate.toISOString());

    if (query.platform) {
      currentQuery = currentQuery.eq("posts.platform", query.platform);
    }

    const { data: currentAnalytics, error: currentError } = await currentQuery;

    if (currentError) {
      throw currentError;
    }

    // Get previous period analytics for comparison
    const previousEndDate = new Date(startDate);
    const previousStartDate = new Date(startDate);
    previousStartDate.setTime(
      previousStartDate.getTime() - (endDate.getTime() - startDate.getTime())
    );

    let previousQuery = supabaseAdmin
      .from("analytics")
      .select(
        `
        impressions,
        clicks,
        likes,
        comments,
        shares,
        saves,
        engagement_rate,
        posts!inner(
          platform,
          posted_at
        )
      `
      )
      .eq("posts.workspace_id", query.workspaceId)
      .gte("fetched_at", previousStartDate.toISOString())
      .lte("fetched_at", previousEndDate.toISOString());

    if (query.platform) {
      previousQuery = previousQuery.eq("posts.platform", query.platform);
    }

    const { data: previousAnalytics, error: previousError } =
      await previousQuery;

    if (previousError) {
      throw previousError;
    }

    // Calculate metrics
    const currentMetrics = calculateMetrics(currentAnalytics || []);
    const previousMetrics = calculateMetrics(previousAnalytics || []);

    // Calculate growth rates
    const growthRates = calculateGrowthRates(currentMetrics, previousMetrics);

    // Get top performing posts
    const topPosts = getTopPerformingPosts(currentAnalytics || []);

    // Get platform breakdown
    const platformBreakdown = getPlatformBreakdown(currentAnalytics || []);

    // Get daily performance for chart data
    const dailyPerformance = getDailyPerformance(
      currentAnalytics || [],
      startDate,
      endDate
    );

    return NextResponse.json({
      success: true,
      data: {
        period: query.period,
        currentMetrics,
        previousMetrics,
        growthRates,
        topPosts: topPosts.slice(0, 5),
        platformBreakdown,
        dailyPerformance,
        summary: {
          totalPosts: currentAnalytics?.length || 0,
          averageEngagementRate: currentMetrics.engagementRate,
          bestPerformingPlatform: platformBreakdown[0]?.platform || "N/A",
          totalReach: currentMetrics.impressions,
        },
      },
    });
  } catch (error) {
    console.error("Get analytics summary error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch analytics summary" },
      { status: 500 }
    );
  }
}

function calculateMetrics(analytics: any[]) {
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

function calculateGrowthRates(current: any, previous: any) {
  const calculateRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  };

  return {
    impressions: calculateRate(current.impressions, previous.impressions),
    clicks: calculateRate(current.clicks, previous.clicks),
    likes: calculateRate(current.likes, previous.likes),
    comments: calculateRate(current.comments, previous.comments),
    shares: calculateRate(current.shares, previous.shares),
    saves: calculateRate(current.saves, previous.saves),
    engagementRate: calculateRate(
      current.engagementRate,
      previous.engagementRate
    ),
    clickThroughRate: calculateRate(
      current.clickThroughRate,
      previous.clickThroughRate
    ),
  };
}

function getTopPerformingPosts(analytics: any[]) {
  return analytics
    .map((item) => ({
      postId: item.posts.id,
      platform: item.posts.platform,
      content: item.posts.content_text?.substring(0, 100) + "...",
      impressions: item.impressions || 0,
      engagement:
        (item.likes || 0) +
        (item.comments || 0) +
        (item.shares || 0) +
        (item.saves || 0),
      engagementRate: item.engagement_rate || 0,
      postedAt: item.posts.posted_at,
    }))
    .sort((a, b) => b.engagement - a.engagement);
}

function getPlatformBreakdown(analytics: any[]) {
  const platformData: { [key: string]: any } = {};

  analytics.forEach((item) => {
    const platform = item.posts.platform;
    if (!platformData[platform]) {
      platformData[platform] = {
        platform,
        impressions: 0,
        engagement: 0,
        posts: 0,
      };
    }

    platformData[platform].impressions += item.impressions || 0;
    platformData[platform].engagement +=
      (item.likes || 0) +
      (item.comments || 0) +
      (item.shares || 0) +
      (item.saves || 0);
    platformData[platform].posts += 1;
  });

  return Object.values(platformData)
    .map((platform: any) => ({
      ...platform,
      engagementRate:
        platform.impressions > 0
          ? Math.round((platform.engagement / platform.impressions) * 10000) /
            100
          : 0,
    }))
    .sort((a: any, b: any) => b.engagement - a.engagement);
}

function getDailyPerformance(analytics: any[], startDate: Date, endDate: Date) {
  const dailyData: { [key: string]: any } = {};

  // Initialize all days in range
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split("T")[0];
    dailyData[dateKey] = {
      date: dateKey,
      impressions: 0,
      engagement: 0,
      posts: 0,
    };
  }

  // Aggregate data by day
  analytics.forEach((item) => {
    const dateKey = new Date(item.fetched_at).toISOString().split("T")[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey].impressions += item.impressions || 0;
      dailyData[dateKey].engagement +=
        (item.likes || 0) +
        (item.comments || 0) +
        (item.shares || 0) +
        (item.saves || 0);
      dailyData[dateKey].posts += 1;
    }
  });

  return Object.values(dailyData).sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
