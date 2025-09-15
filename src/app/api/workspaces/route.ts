import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  plan: z.enum(["free", "pro", "agency"]).default("free"),
});

// GET /api/workspaces - Get user's workspaces
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: workspaces, error } = await supabaseAdmin
      .from("workspace_members")
      .select(`
        workspace_id,
        role,
        created_at,
        workspaces!inner(
          id,
          name,
          owner_id,
          plan,
          ai_credits_used,
          ai_credits_limit,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the data structure
    const transformedWorkspaces = workspaces?.map((item) => ({
      ...item.workspaces,
      role: item.role,
      member_since: item.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedWorkspaces,
    });
  } catch (error) {
    console.error("Get workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createWorkspaceSchema.parse(body);

    // Start transaction - create workspace and add owner as member
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name: validatedData.name,
        owner_id: session.user.id,
        plan: validatedData.plan,
      })
      .select()
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    // Add owner as workspace member
    const { error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: session.user.id,
        role: "owner",
      });

    if (memberError) {
      // Rollback workspace creation
      await supabaseAdmin.from("workspaces").delete().eq("id", workspace.id);
      throw memberError;
    }

    return NextResponse.json({
      success: true,
      data: { ...workspace, role: "owner", member_since: workspace.created_at },
      message: "Workspace created successfully",
    });
  } catch (error) {
    console.error("Create workspace error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid workspace data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
