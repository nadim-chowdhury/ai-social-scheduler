import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(["free", "pro", "agency"]).optional(),
});

// GET /api/workspaces/[id] - Get workspace details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if user has access to this workspace
    const { data: member, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", id)
      .eq("user_id", session.user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    return NextResponse.json({
      success: true,
      data: { ...workspace, role: member.role },
    });
  } catch (error) {
    console.error("Get workspace error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

// PUT /api/workspaces/[id] - Update workspace
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const validatedData = updateWorkspaceSchema.parse(body);

    // Check if user is owner or admin
    const { data: member, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", id)
      .eq("user_id", session.user.id)
      .single();

    if (memberError || !member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    return NextResponse.json({
      success: true,
      data: { ...workspace, role: member.role },
      message: "Workspace updated successfully",
    });
  } catch (error) {
    console.error("Update workspace error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid workspace data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if user is the owner
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (workspaceError || !workspace || workspace.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "Workspace not found or permission denied" },
        { status: 404 }
      );
    }

    // Delete workspace (cascade will handle related records)
    const { error: deleteError } = await supabaseAdmin
      .from("workspaces")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
