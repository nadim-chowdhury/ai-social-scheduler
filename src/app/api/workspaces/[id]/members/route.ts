import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
});

// GET /api/workspaces/[id]/members - Get workspace members
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

    // Get all workspace members
    const { data: members, error: membersError } = await supabaseAdmin
      .from("workspace_members")
      .select(`
        id,
        role,
        created_at,
        users!inner(
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq("workspace_id", id)
      .order("created_at", { ascending: true });

    if (membersError) {
      throw membersError;
    }

    // Transform the data structure
    const transformedMembers = members?.map((item) => ({
      id: item.id,
      role: item.role,
      joined_at: item.created_at,
      user: item.users,
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedMembers,
    });
  } catch (error) {
    console.error("Get workspace members error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace members" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[id]/members - Invite member to workspace
export async function POST(
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
    const validatedData = inviteMemberSchema.parse(body);

    // Check if user has permission to invite (owner or admin)
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

    // Check if user exists
    const { data: userToInvite, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, name, avatar_url")
      .eq("email", validatedData.email)
      .single();

    if (userError || !userToInvite) {
      return NextResponse.json(
        { error: "User not found. They need to sign up first." },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", id)
      .eq("user_id", userToInvite.id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 }
      );
    }

    // Add user as workspace member
    const { data: newMember, error: addMemberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: id,
        user_id: userToInvite.id,
        role: validatedData.role,
      })
      .select()
      .single();

    if (addMemberError) {
      throw addMemberError;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newMember.id,
        role: newMember.role,
        joined_at: newMember.created_at,
        user: userToInvite,
      },
      message: "Member invited successfully",
    });
  } catch (error) {
    console.error("Invite member error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid invitation data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}
