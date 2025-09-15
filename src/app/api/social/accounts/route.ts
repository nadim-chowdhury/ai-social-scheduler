import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserWorkspaceAccess } from "@/lib/auth";
import { z } from "zod";

const querySchema = z.object({
  workspaceId: z.string().uuid(),
});

// GET /api/social/accounts - Get social accounts for a workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { workspaceId } = querySchema.parse({
      workspaceId: searchParams.get("workspaceId"),
    });

    // Check workspace access
    const userRole = await getUserWorkspaceAccess(session.user.id, workspaceId);
    if (!userRole) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get social accounts for the workspace
    const { data: accounts, error } = await supabaseAdmin
      .from("social_accounts")
      .select(`
        id,
        platform,
        platform_user_id,
        platform_username,
        name,
        is_active,
        connected_at,
        token_expires_at
      `)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("connected_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Transform data to hide sensitive information
    const transformedAccounts = accounts?.map((account) => ({
      ...account,
      is_token_valid: account.token_expires_at 
        ? new Date(account.token_expires_at) > new Date() 
        : true,
      token_expires_in: account.token_expires_at 
        ? Math.max(0, Math.floor((new Date(account.token_expires_at).getTime() - Date.now()) / 1000))
        : null,
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedAccounts,
    });
  } catch (error) {
    console.error("Get social accounts error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch social accounts" },
      { status: 500 }
    );
  }
}
