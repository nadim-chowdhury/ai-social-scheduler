import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

// GET /api/users/me - Get current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, avatar_url, created_at, updated_at")
      .eq("id", session.user.id)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

// PUT /api/users/me - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id)
      .select("id, email, name, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update user profile error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid profile data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
