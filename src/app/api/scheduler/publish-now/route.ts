import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PostScheduler } from "@/lib/scheduler";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: "Missing required field: postId" },
        { status: 400 }
      );
    }

    // Publish the post immediately
    const result = await PostScheduler.publishNow(postId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        message: "Post queued for immediate publishing",
      },
    });
  } catch (error) {
    console.error("Publish now error:", error);
    return NextResponse.json(
      { error: "Failed to publish post" },
      { status: 500 }
    );
  }
}
