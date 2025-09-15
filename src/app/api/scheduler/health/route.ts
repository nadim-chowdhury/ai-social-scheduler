import { NextResponse } from "next/server";
import { checkQueueHealth } from "@/lib/queue";

export async function GET() {
  try {
    const health = await checkQueueHealth();

    const isHealthy = health.every((queue) => queue.isHealthy);
    const totalJobs = health.reduce(
      (sum, queue) =>
        sum + queue.waiting + queue.active + queue.completed + queue.failed,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        isHealthy,
        totalJobs,
        queues: health,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Health check failed",
        data: {
          isHealthy: false,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
