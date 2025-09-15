import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updateMemberSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

// PUT /api/workspaces/[id]/members/[memberId] - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = params;
    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // Check if user has permission (owner or admin)
    const { data: currentMember, error: currentMemberError } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", id)
      .eq("user_id", session.user.id)
      .single();

    if (currentMemberError || !currentMember || !["owner", "admin"].includes(currentMember.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Check if member exists and get their current role
    const { data: memberToUpdate, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select(`
        id,
        role,
        user_id,
        users!inner(
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq("id", memberId)
      .eq("workspace_id", id)
      .single();

    if (memberError || !memberToUpdate) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent changing owner role
    if (memberToUpdate.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    // Update member role
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from("workspace_members")
      .update({ role: validatedData.role })
      .eq("id", memberId)
      .eq("workspace_id", id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMember.id,
        role: updatedMember.role,
        joined_at: updatedMember.created_at,
        user: memberToUpdate.users,
      },
      message: "Member role updated successfully",
    });
  } catch (error) {
    console.error("Update member error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid member data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/members/[memberId] - Remove member from workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = params;

    // Check if user has permission (owner or admin)
    const { data: currentMember, error: currentMemberError } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", id)
      .eq("user_id", session.user.id)
      .single();

    if (currentMemberError || !currentMember || !["owner", "admin"].includes(currentMember.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Check if member exists and get their role
    const { data: memberToRemove, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("workspace_id", id)
      .single();

    if (memberError || !memberToRemove) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent removing the owner
    if (memberToRemove.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove workspace owner" },
        { status: 400 }
      );
    }

    // Remove member
    const { error: deleteError } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
