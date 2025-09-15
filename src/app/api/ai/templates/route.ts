import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { promptTemplateService, PromptTemplate } from "@/lib/prompt-templates";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  prompt: z.string().min(1).max(2000),
  variables: z.array(z.string()).min(1),
  description: z.string().min(1).max(500),
  platform: z.string().optional(),
  tone: z.string().optional(),
  workspaceId: z.string().uuid(),
});

const updateTemplateSchema = createTemplateSchema.partial().omit({ workspaceId: true });

// GET /api/ai/templates - Get all templates for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const category = searchParams.get("category");
    const platform = searchParams.get("platform");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required" },
        { status: 400 }
      );
    }

    // Check workspace access
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", session.user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get default templates
    let templates = promptTemplateService.getAllTemplates();

    // Filter by category if specified
    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    // Filter by platform if specified
    if (platform) {
      templates = templates.filter(t => !t.platform || t.platform === platform);
    }

    // Get custom templates from database
    const { data: customTemplates } = await supabaseAdmin
      .from("ai_templates")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Combine default and custom templates
    const allTemplates = [
      ...templates,
      ...(customTemplates || []).map(ct => ({
        id: ct.id,
        name: ct.name,
        category: ct.category,
        prompt: ct.prompt,
        variables: ct.variables,
        description: ct.description,
        platform: ct.platform,
        tone: ct.tone,
        isDefault: false,
      }))
    ];

    return NextResponse.json({
      success: true,
      data: allTemplates,
    });
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/ai/templates - Create custom template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTemplateSchema.parse(body);

    const { workspaceId, ...templateData } = validatedData;

    // Check workspace access and permissions
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", session.user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Save template to database
    const { data: template, error: insertError } = await supabaseAdmin
      .from("ai_templates")
      .insert({
        workspace_id: workspaceId,
        created_by: session.user.id,
        ...templateData,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: "Template created successfully",
    });
  } catch (error) {
    console.error("Create template error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid template data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}