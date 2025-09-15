import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/social/accounts/[id] - Get specific social account
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

    // Get social account with workspace info
    const { data: account, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select(`
        id,
        platform,
        platform_user_id,
        platform_username,
        name,
        is_active,
        connected_at,
        token_expires_at,
        workspaces!inner(id)
      `)
      .eq("id", id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Social account not found" },
        { status: 404 }
      );
    }

    // Check workspace access
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", account.workspaces.id)
      .eq("user_id", session.user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Transform data
    const transformedAccount = {
      ...account,
      is_token_valid: account.token_expires_at 
        ? new Date(account.token_expires_at) > new Date() 
        : true,
      token_expires_in: account.token_expires_at 
        ? Math.max(0, Math.floor((new Date(account.token_expires_at).getTime() - Date.now()) / 1000))
        : null,
    };

    return NextResponse.json({
      success: true,
      data: transformedAccount,
    });
  } catch (error) {
    console.error("Get social account error:", error);
    return NextResponse.json(
      { error: "Failed to fetch social account" },
      { status: 500 }
    );
  }
}

// PUT /api/social/accounts/[id] - Update social account
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
    const validatedData = updateSchema.parse(body);

    // Get social account with workspace info
    const { data: account, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select(`
        id,
        workspaces!inner(id)
      `)
      .eq("id", id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Social account not found" },
        { status: 404 }
      );
    }

    // Check workspace access and permissions
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", account.workspaces.id)
      .eq("user_id", session.user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Update account
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update(validatedData)
      .eq("id", id)
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
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: "Social account updated successfully",
    });
  } catch (error) {
    console.error("Update social account error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid update data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update social account" },
      { status: 500 }
    );
  }
}

// DELETE /api/social/accounts/[id] - Disconnect social account
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

    // Get social account with workspace info
    const { data: account, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select(`
        id,
        workspaces!inner(id)
      `)
      .eq("id", id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Social account not found" },
        { status: 404 }
      );
    }

    // Check workspace access and permissions
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", account.workspaces.id)
      .eq("user_id", session.user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Soft delete the account (set is_active to false)
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({ 
        is_active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Social account disconnected successfully",
    });
  } catch (error) {
    console.error("Disconnect social account error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect social account" },
      { status: 500 }
    );
  }
}