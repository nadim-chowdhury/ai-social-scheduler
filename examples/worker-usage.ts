/**
 * Example usage of the AI Social Scheduler Background Worker System
 *
 * This file demonstrates how to:
 * 1. Schedule posts for future publishing
 * 2. Publish posts immediately
 * 3. Generate AI content
 * 4. Monitor queue health
 * 5. Handle errors and retries
 */

import { PostScheduler, AIScheduler } from "../src/lib/scheduler";
import {
  addPostSchedulerJob,
  addAIGenerationJob,
  checkQueueHealth,
} from "../src/lib/queue";

// Example 1: Schedule a post for future publishing
async function schedulePostExample() {
  const postId = "post-uuid-123";
  const workspaceId = "workspace-uuid-456";
  const socialAccountId = "account-uuid-789";
  const scheduledAt = new Date("2024-01-15T10:00:00Z");

  try {
    const result = await PostScheduler.schedulePost(
      postId,
      workspaceId,
      socialAccountId,
      scheduledAt
    );

    if (result.success) {
      console.log("✅ Post scheduled successfully");
    } else {
      console.error("❌ Failed to schedule post:", result.error);
    }
  } catch (error) {
    console.error("❌ Error scheduling post:", error);
  }
}

// Example 2: Publish a post immediately
async function publishNowExample() {
  const postId = "post-uuid-123";

  try {
    const result = await PostScheduler.publishNow(postId);

    if (result.success) {
      console.log("✅ Post queued for immediate publishing");
    } else {
      console.error("❌ Failed to publish post:", result.error);
    }
  } catch (error) {
    console.error("❌ Error publishing post:", error);
  }
}

// Example 3: Reschedule a post
async function reschedulePostExample() {
  const postId = "post-uuid-123";
  const newScheduledAt = new Date("2024-01-16T14:30:00Z");

  try {
    const result = await PostScheduler.reschedulePost(postId, newScheduledAt);

    if (result.success) {
      console.log("✅ Post rescheduled successfully");
    } else {
      console.error("❌ Failed to reschedule post:", result.error);
    }
  } catch (error) {
    console.error("❌ Error rescheduling post:", error);
  }
}

// Example 4: Cancel a scheduled post
async function cancelScheduledPostExample() {
  const postId = "post-uuid-123";

  try {
    const result = await PostScheduler.cancelScheduledPost(postId);

    if (result.success) {
      console.log("✅ Post scheduling cancelled");
    } else {
      console.error("❌ Failed to cancel post:", result.error);
    }
  } catch (error) {
    console.error("❌ Error cancelling post:", error);
  }
}

// Example 5: Get scheduled posts for a workspace
async function getScheduledPostsExample() {
  const workspaceId = "workspace-uuid-456";
  const limit = 20;

  try {
    const result = await PostScheduler.getScheduledPosts(workspaceId, limit);

    if (result.success) {
      console.log("✅ Scheduled posts:", result.data);
    } else {
      console.error("❌ Failed to fetch scheduled posts:", result.error);
    }
  } catch (error) {
    console.error("❌ Error fetching scheduled posts:", error);
  }
}

// Example 6: Queue AI content generation
async function queueAIGenerationExample() {
  const requestId = "ai-request-uuid-123";
  const workspaceId = "workspace-uuid-456";
  const type = "text" as const;
  const prompt =
    "Create an engaging social media post about our new product launch";
  const provider = "openai";

  try {
    const result = await AIScheduler.queueAIGeneration(
      requestId,
      workspaceId,
      type,
      prompt,
      provider
    );

    if (result.success) {
      console.log("✅ AI generation queued successfully");
    } else {
      console.error("❌ Failed to queue AI generation:", result.error);
    }
  } catch (error) {
    console.error("❌ Error queuing AI generation:", error);
  }
}

// Example 7: Check queue health
async function checkQueueHealthExample() {
  try {
    const health = await checkQueueHealth();

    console.log("📊 Queue Health Status:");
    health.forEach((queue) => {
      console.log(`  ${queue.name}:`);
      console.log(`    - Waiting: ${queue.waiting}`);
      console.log(`    - Active: ${queue.active}`);
      console.log(`    - Completed: ${queue.completed}`);
      console.log(`    - Failed: ${queue.failed}`);
      console.log(`    - Healthy: ${queue.isHealthy ? "✅" : "❌"}`);
    });

    const isOverallHealthy = health.every((queue) => queue.isHealthy);
    console.log(
      `\nOverall Health: ${isOverallHealthy ? "✅ Healthy" : "❌ Unhealthy"}`
    );
  } catch (error) {
    console.error("❌ Error checking queue health:", error);
  }
}

// Example 8: Direct queue job addition (advanced usage)
async function directQueueJobExample() {
  try {
    // Add a post scheduler job directly
    await addPostSchedulerJob(
      {
        postId: "post-uuid-123",
        workspaceId: "workspace-uuid-456",
        socialAccountId: "account-uuid-789",
        scheduledAt: new Date("2024-01-15T10:00:00Z").toISOString(),
        attempt: 1,
      },
      5000
    ); // 5 second delay

    console.log("✅ Post scheduler job added directly");

    // Add an AI generation job directly
    await addAIGenerationJob({
      requestId: "ai-request-uuid-123",
      workspaceId: "workspace-uuid-456",
      type: "image",
      prompt: "A futuristic social media app interface",
      provider: "openai",
      attempt: 1,
    });

    console.log("✅ AI generation job added directly");
  } catch (error) {
    console.error("❌ Error adding jobs directly:", error);
  }
}

// Example 9: Error handling and retry logic
async function errorHandlingExample() {
  const postId = "post-uuid-123";

  try {
    const result = await PostScheduler.publishNow(postId);

    if (!result.success) {
      // Handle specific error types
      if (result.error?.includes("not found")) {
        console.log("📝 Post not found, creating new post...");
        // Handle post creation logic
      } else if (result.error?.includes("rate limit")) {
        console.log("⏳ Rate limited, retrying in 1 minute...");
        // Implement retry logic
        setTimeout(() => {
          PostScheduler.publishNow(postId);
        }, 60000);
      } else {
        console.error("❌ Unexpected error:", result.error);
      }
    }
  } catch (error) {
    console.error("❌ Critical error:", error);
    // Implement fallback logic or alerting
  }
}

// Example 10: Batch operations
async function batchOperationsExample() {
  const posts = [
    { id: "post-1", scheduledAt: new Date("2024-01-15T10:00:00Z") },
    { id: "post-2", scheduledAt: new Date("2024-01-15T11:00:00Z") },
    { id: "post-3", scheduledAt: new Date("2024-01-15T12:00:00Z") },
  ];

  const workspaceId = "workspace-uuid-456";
  const socialAccountId = "account-uuid-789";

  try {
    // Schedule multiple posts
    const results = await Promise.allSettled(
      posts.map((post) =>
        PostScheduler.schedulePost(
          post.id,
          workspaceId,
          socialAccountId,
          post.scheduledAt
        )
      )
    );

    // Process results
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        console.log(`✅ Post ${posts[index].id} scheduled successfully`);
      } else {
        console.error(
          `❌ Post ${posts[index].id} failed to schedule:`,
          result.status === "rejected" ? result.reason : result.value.error
        );
      }
    });
  } catch (error) {
    console.error("❌ Error in batch operations:", error);
  }
}

// Example 11: Monitoring and alerting
async function monitoringExample() {
  try {
    const health = await checkQueueHealth();

    // Check for unhealthy queues
    const unhealthyQueues = health.filter((queue) => !queue.isHealthy);

    if (unhealthyQueues.length > 0) {
      console.warn("⚠️ Unhealthy queues detected:");
      unhealthyQueues.forEach((queue) => {
        console.warn(`  - ${queue.name}: ${queue.failed} failed jobs`);
      });

      // Send alert (implement your alerting logic)
      // await sendAlert(`Unhealthy queues: ${unhealthyQueues.map(q => q.name).join(', ')}`);
    }

    // Check for high job counts
    const highJobQueues = health.filter((queue) => queue.waiting > 100);

    if (highJobQueues.length > 0) {
      console.warn("⚠️ High job counts detected:");
      highJobQueues.forEach((queue) => {
        console.warn(`  - ${queue.name}: ${queue.waiting} waiting jobs`);
      });
    }

    // Check for failed jobs
    const failedJobQueues = health.filter((queue) => queue.failed > 10);

    if (failedJobQueues.length > 0) {
      console.error("❌ High failure rates detected:");
      failedJobQueues.forEach((queue) => {
        console.error(`  - ${queue.name}: ${queue.failed} failed jobs`);
      });

      // Send critical alert
      // await sendCriticalAlert(`High failure rates in queues: ${failedJobQueues.map(q => q.name).join(', ')}`);
    }
  } catch (error) {
    console.error("❌ Error in monitoring:", error);
  }
}

// Export all examples for use
export {
  schedulePostExample,
  publishNowExample,
  reschedulePostExample,
  cancelScheduledPostExample,
  getScheduledPostsExample,
  queueAIGenerationExample,
  checkQueueHealthExample,
  directQueueJobExample,
  errorHandlingExample,
  batchOperationsExample,
  monitoringExample,
};

// Run examples (uncomment to test)
// if (require.main === module) {
//   (async () => {
//     console.log('🚀 Running AI Social Scheduler Worker Examples...\n');
//
//     await checkQueueHealthExample();
//     console.log('\n' + '='.repeat(50) + '\n');
//
//     await schedulePostExample();
//     console.log('\n' + '='.repeat(50) + '\n');
//
//     await queueAIGenerationExample();
//     console.log('\n' + '='.repeat(50) + '\n');
//
//     await monitoringExample();
//   })();
// }
