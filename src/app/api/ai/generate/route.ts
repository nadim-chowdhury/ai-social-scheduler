import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiService, ContentGenerationOptions } from "@/lib/ai-providers";
import { promptTemplateService } from "@/lib/prompt-templates";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const generateSchema = z.object({
  type: z.enum(["text", "image", "video_script"]),
  prompt: z.string().min(1),
  provider: z.string().optional(),
  workspaceId: z.string().uuid(),
  templateId: z.string().optional(),
  templateVariables: z.record(z.string()).optional(),
  options: z.object({
    tone: z.enum(["professional", "casual", "funny", "inspirational", "educational"]).optional(),
    platform: z.enum(["facebook", "instagram", "twitter", "linkedin", "youtube", "tiktok"]).optional(),
    maxLength: z.number().min(1).max(2000).optional(),
    includeHashtags: z.boolean().optional(),
    includeEmojis: z.boolean().optional(),
    language: z.string().optional(),
  }).optional(),
});

// POST /api/ai/generate - Generate AI content
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = generateSchema.parse(body);

    const { type, prompt, provider, workspaceId, templateId, templateVariables, options } = validatedData;

    // Check workspace access
    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("id, ai_credits_used, ai_credits_limit")
      .eq("id", workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check AI credits
    if (workspace.ai_credits_used >= workspace.ai_credits_limit) {
      return NextResponse.json(
        { error: "AI credits limit reached" },
        { status: 403 }
      );
    }

    // Process template if provided
    let finalPrompt = prompt;
    if (templateId && templateVariables) {
      try {
        finalPrompt = promptTemplateService.processTemplate(templateId, templateVariables);
      } catch (error) {
        return NextResponse.json(
          { error: `Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 400 }
        );
      }
    }

    // Generate content based on type
    let result;
    let cost = 0;

    switch (type) {
      case "text":
        result = await aiService.generateText(finalPrompt, options, provider);
        cost = result.cost;
        break;

      case "image":
        result = await aiService.generateImage(finalPrompt, options, provider);
        cost = result.cost;
        break;

      case "video_script":
        result = await aiService.generateVideoScript(finalPrompt, options, provider);
        cost = result.cost;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid generation type" },
          { status: 400 }
        );
    }

    // Record AI request
    const { data: aiRequest, error: insertError } = await supabaseAdmin
      .from("ai_requests")
      .insert({
        workspace_id: workspaceId,
        user_id: session.user.id,
        request_type: type,
        provider: result.provider,
        cost,
        prompt: finalPrompt,
        response: result,
        status: "completed",
        completed_at: new Date().toISOString(),
        template_id: templateId,
        template_variables: templateVariables,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to record AI request:", insertError);
    }

    // Update workspace AI credits
    await supabaseAdmin
      .from("workspaces")
      .update({
        ai_credits_used: workspace.ai_credits_used + 1,
      })
      .eq("id", workspaceId);

    // Return appropriate response based on type
    const responseData = {
      id: aiRequest?.id,
      type,
      provider: result.provider,
      cost,
      moderated: result.moderated,
      moderationFlags: result.moderationFlags,
    };

    if (type === "text") {
      return NextResponse.json({
        success: true,
        data: {
          ...responseData,
          content: result.text,
          hashtags: result.hashtags,
          emojis: result.emojis,
        },
      });
    } else if (type === "image") {
      return NextResponse.json({
        success: true,
        data: {
          ...responseData,
          url: result.url,
        },
      });
    } else if (type === "video_script") {
      return NextResponse.json({
        success: true,
        data: {
          ...responseData,
          script: result,
        },
      });
    }

  } catch (error) {
    console.error("AI generation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
