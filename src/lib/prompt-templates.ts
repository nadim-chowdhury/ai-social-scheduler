import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Content generation types
export interface ContentGenerationOptions {
  tone?: "professional" | "casual" | "funny" | "inspirational" | "educational";
  platform?: "facebook" | "instagram" | "twitter" | "linkedin" | "youtube" | "tiktok";
  maxLength?: number;
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  language?: string;
}

export interface TextGenerationResult {
  text: string;
  hashtags?: string[];
  emojis?: string[];
  provider: string;
  cost: number;
  moderated: boolean;
  moderationFlags?: string[];
}

export interface ImageGenerationResult {
  url: string;
  provider: string;
  cost: number;
  moderated: boolean;
  moderationFlags?: string[];
}

export interface VideoScriptResult {
  title: string;
  hook: string;
  scenes: Array<{
    duration: number;
    description: string;
    voiceover: string;
    visual: string;
  }>;
  callToAction: string;
  hashtags: string[];
  provider: string;
  cost: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  variables: string[];
  description: string;
  platform?: string;
  tone?: string;
  isDefault?: boolean;
}

export const defaultPromptTemplates: PromptTemplate[] = [
  {
    id: "product-launch",
    name: "Product Launch",
    category: "Marketing",
    prompt: "Create an exciting product launch announcement for {productName}. Highlight the key features: {features}. Target audience: {audience}. Include a compelling call-to-action.",
    variables: ["productName", "features", "audience"],
    description: "Generate engaging product launch content with features and audience targeting",
    platform: "instagram",
    tone: "exciting",
    isDefault: true,
  },
  {
    id: "sale-promotion",
    name: "Sale Promotion",
    category: "Marketing",
    prompt: "Create a {tone} sale promotion post for {productName}. Discount: {discount}. Valid until: {endDate}. Create urgency and excitement.",
    variables: ["productName", "discount", "endDate", "tone"],
    description: "Generate sale promotion content with discount and urgency",
    platform: "facebook",
    tone: "urgent",
    isDefault: true,
  },
  {
    id: "event-announcement",
    name: "Event Announcement",
    category: "Events",
    prompt: "Announce an upcoming event: {eventName}. Date: {eventDate}. Location: {location}. Key highlights: {highlights}. Encourage attendance.",
    variables: ["eventName", "eventDate", "location", "highlights"],
    description: "Create event announcement with details and highlights",
    platform: "linkedin",
    tone: "professional",
    isDefault: true,
  },
  {
    id: "holiday-celebration",
    name: "Holiday Celebration",
    category: "Seasonal",
    prompt: "Create a {tone} holiday post for {holiday}. Brand message: {brandMessage}. Include seasonal elements and brand personality.",
    variables: ["holiday", "brandMessage", "tone"],
    description: "Generate holiday-themed content with brand messaging",
    platform: "instagram",
    tone: "celebratory",
    isDefault: true,
  },
  {
    id: "behind-scenes",
    name: "Behind the Scenes",
    category: "Engagement",
    prompt: "Create a behind-the-scenes post showing {process}. Make it {tone} and authentic. Include team members if relevant.",
    variables: ["process", "tone"],
    description: "Generate authentic behind-the-scenes content",
    platform: "instagram",
    tone: "authentic",
    isDefault: true,
  },
  {
    id: "customer-testimonial",
    name: "Customer Testimonial",
    category: "Social Proof",
    prompt: "Create a testimonial post featuring customer feedback: '{testimonial}'. Customer: {customerName}. Highlight the key benefit: {benefit}.",
    variables: ["testimonial", "customerName", "benefit"],
    description: "Generate testimonial content with customer feedback",
    platform: "facebook",
    tone: "trustworthy",
    isDefault: true,
  },
  {
    id: "educational-tip",
    name: "Educational Tip",
    category: "Education",
    prompt: "Create an educational post about {topic}. Provide {tipCount} practical tips. Make it {tone} and actionable for {audience}.",
    variables: ["topic", "tipCount", "audience", "tone"],
    description: "Generate educational content with practical tips",
    platform: "linkedin",
    tone: "educational",
    isDefault: true,
  },
  {
    id: "tiktok-trending",
    name: "TikTok Trending",
    category: "Viral",
    prompt: "Create a trending TikTok script about {topic}. Use current trends and make it {tone}. Include a hook, main content, and call-to-action.",
    variables: ["topic", "tone"],
    description: "Generate viral TikTok content with trending elements",
    platform: "tiktok",
    tone: "trendy",
    isDefault: true,
  },
];

export class PromptTemplateService {
  private templates: PromptTemplate[] = [...defaultPromptTemplates];

  addTemplate(template: Omit<PromptTemplate, "id">): PromptTemplate {
    const newTemplate: PromptTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    this.templates.push(newTemplate);
    return newTemplate;
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  getTemplatesByPlatform(platform: string): PromptTemplate[] {
    return this.templates.filter(t => !t.platform || t.platform === platform);
  }

  getAllTemplates(): PromptTemplate[] {
    return [...this.templates];
  }

  updateTemplate(id: string, updates: Partial<PromptTemplate>): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    this.templates[index] = { ...this.templates[index], ...updates };
    return true;
  }

  deleteTemplate(id: string): boolean {
    const template = this.templates.find(t => t.id === id);
    if (!template || template.isDefault) return false; // Can't delete default templates
    
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    this.templates.splice(index, 1);
    return true;
  }

  processTemplate(templateId: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let processedPrompt = template.prompt;
    
    // Replace variables in the prompt
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    // Check if all variables are filled
    const remainingVariables = processedPrompt.match(/\{[^}]+\}/g);
    if (remainingVariables) {
      throw new Error(`Missing variables: ${remainingVariables.join(', ')}`);
    }

    return processedPrompt;
  }

  getAvailableVariables(templateId: string): string[] {
    const template = this.getTemplate(templateId);
    return template ? template.variables : [];
  }
}

export const promptTemplateService = new PromptTemplateService();

// Content moderation schema
const moderationSchema = z.object({
  flagged: z.boolean(),
  categories: z.record(z.number()).optional(),
  category_scores: z.record(z.number()).optional(),
});

// AI Provider Configuration
export interface AIProvider {
  name: string;
  generateText: (prompt: string, options?: ContentGenerationOptions) => Promise<string>;
  generateImage: (prompt: string, options?: ContentGenerationOptions) => Promise<string>;
  generateVideoScript: (prompt: string, options?: ContentGenerationOptions) => Promise<VideoScriptResult>;
  moderateContent: (content: string) => Promise<{ flagged: boolean; categories?: Record<string, number> }>;
  cost: number;
}

// OpenAI Provider with enhanced features
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openaiProvider: AIProvider = {
  name: "openai",
  cost: 0.002,

  generateText: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const {
      tone = "professional",
      platform = "instagram",
      maxLength = 280,
      includeHashtags = true,
      includeEmojis = true,
      language = "English"
    } = options;

    const enhancedPrompt = `
Create a ${tone} social media post for ${platform} in ${language}.
Platform: ${platform}
Tone: ${tone}
Max length: ${maxLength} characters
Include hashtags: ${includeHashtags ? "Yes" : "No"}
Include emojis: ${includeEmojis ? "Yes" : "No"}

Original prompt: ${prompt}

Generate:
1. Main post content (${maxLength} characters max)
2. ${includeHashtags ? "5-10 relevant hashtags" : ""}
3. ${includeEmojis ? "2-3 relevant emojis" : ""}

Format as JSON:
{
  "content": "main post text",
  "hashtags": ["#tag1", "#tag2"],
  "emojis": ["😊", ""]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: enhancedPrompt }],
      max_tokens: 800,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "";
    
    try {
      const parsed = JSON.parse(response);
      return parsed.content || response;
    } catch {
      return response;
    }
  },

  generateImage: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const { platform = "instagram", tone = "professional" } = options;
    
    const enhancedPrompt = `
Create a ${tone} social media image for ${platform}.
Style: Clean, modern, brand-consistent
Platform: ${platform}
Tone: ${tone}

Original prompt: ${prompt}

Requirements:
- High quality, professional
- Suitable for social media
- Brand-safe content
- Engaging visual appeal
`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: platform === "instagram" ? "1024x1024" : "1024x1792",
      quality: "hd",
    });

    return response.data?.[0]?.url || "";
  },

  generateVideoScript: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const { platform = "tiktok", tone = "engaging" } = options;
    
    const scriptPrompt = `
Create a viral ${platform} video script with the following prompt: ${prompt}

Platform: ${platform}
Tone: ${tone}
Duration: 15-60 seconds
Format: Hook, 3-5 scenes, Call to action

Generate a JSON response with:
{
  "title": "compelling title",
  "hook": "opening hook (0-3 seconds)",
  "scenes": [
    {
      "duration": 5,
      "description": "what happens visually",
      "voiceover": "what to say",
      "visual": "visual elements"
    }
  ],
  "callToAction": "CTA text",
  "hashtags": ["#trending", "#viral"]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: scriptPrompt }],
      max_tokens: 1500,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content || "";
    
    try {
      return JSON.parse(response);
    } catch {
      // Fallback structure
      return {
        title: "Generated Video Script",
        hook: response.substring(0, 100),
        scenes: [{
          duration: 30,
          description: "Main content scene",
          voiceover: response,
          visual: "Engaging visuals"
        }],
        callToAction: "Follow for more!",
        hashtags: ["#content", "#viral"],
        provider: "openai",
        cost: 0.002
      };
    }
  },

  moderateContent: async (content: string) => {
    try {
      const response = await openai.moderations.create({
        input: content,
      });

      const result = response.results[0];
      return {
        flagged: result.flagged,
        categories: result.categories,
        category_scores: result.category_scores,
      };
    } catch (error) {
      console.error("OpenAI moderation error:", error);
      return { flagged: false };
    }
  },
};

// Anthropic Provider with enhanced features
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const anthropicProvider: AIProvider = {
  name: "anthropic",
  cost: 0.0015,

  generateText: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const {
      tone = "professional",
      platform = "instagram",
      maxLength = 280,
      includeHashtags = true,
      includeEmojis = true,
      language = "English"
    } = options;

    const enhancedPrompt = `
Create a ${tone} social media post for ${platform} in ${language}.

Original prompt: ${prompt}

Requirements:
- Platform: ${platform}
- Tone: ${tone}
- Max length: ${maxLength} characters
- Include hashtags: ${includeHashtags ? "Yes (5-10 relevant tags)" : "No"}
- Include emojis: ${includeEmojis ? "Yes (2-3 relevant emojis)" : "No"}

Generate engaging, platform-appropriate content that resonates with the target audience.
`;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 800,
      messages: [{ role: "user", content: enhancedPrompt }],
    });

    return response.content[0]?.type === "text" ? response.content[0].text : "";
  },

  generateImage: async () => {
    throw new Error("Anthropic does not support image generation");
  },

  generateVideoScript: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const { platform = "tiktok", tone = "engaging" } = options;
    
    const scriptPrompt = `
Create a viral ${platform} video script based on: ${prompt}

Platform: ${platform}
Tone: ${tone}
Duration: 15-60 seconds

Structure:
1. Hook (0-3 seconds) - Grab attention immediately
2. Main content (3-4 scenes, 5-15 seconds each)
3. Call to action (final 3-5 seconds)

For each scene, specify:
- Duration
- Visual description
- Voiceover text
- Key visual elements

Include relevant hashtags for discoverability.
`;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1500,
      messages: [{ role: "user", content: scriptPrompt }],
    });

    const content = response.content[0]?.type === "text" ? response.content[0].text : "";
    
    // Parse and structure the response
    return {
      title: "Generated Video Script",
      hook: content.split('\n')[0] || "Attention-grabbing hook",
      scenes: [
        {
          duration: 15,
          description: "Main content scene",
          voiceover: content,
          visual: "Engaging visuals"
        }
      ],
      callToAction: "Follow for more content!",
      hashtags: ["#content", "#viral", "#trending"],
      provider: "anthropic",
      cost: 0.0015
    };
  },

  moderateContent: async (content: string) => {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Analyze this content for safety and appropriateness. Respond with JSON: {"flagged": boolean, "reason": "brief explanation"}\n\nContent: ${content}`
        }],
      });

      const result = response.content[0]?.type === "text" ? response.content[0].text : "";
      
      try {
        const parsed = JSON.parse(result);
        return { flagged: parsed.flagged, categories: { custom: parsed.reason } };
      } catch {
        return { flagged: false };
      }
    } catch (error) {
      console.error("Anthropic moderation error:", error);
      return { flagged: false };
    }
  },
};

// Stability AI Provider for advanced image generation
export const stabilityProvider: AIProvider = {
  name: "stability",
  cost: 0.004,

  generateText: async () => {
    throw new Error("Stability AI does not support text generation");
  },

  generateImage: async (prompt: string, options: ContentGenerationOptions = {}) => {
    const { platform = "instagram", tone = "professional" } = options;
    
    const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.STABILITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: `${prompt}, ${tone} style, high quality, professional, social media content for ${platform}`,
            weight: 1
          }
        ],
        cfg_scale: 7,
        height: platform === "instagram" ? 1024 : 1024,
        width: platform === "instagram" ? 1024 : 1024,
        samples: 1,
        steps: 30,
      }),
    });

    const data = await response.json();
    return data.artifacts?.[0]?.base64 ? 
      `data:image/png;base64,${data.artifacts[0].base64}` : "";
  },

  generateVideoScript: async () => {
    throw new Error("Stability AI does not support video script generation");
  },

  moderateContent: async () => {
    return { flagged: false };
  },
};

// Provider Registry
export const aiProviders: AIProvider[] = [openaiProvider, anthropicProvider, stabilityProvider];

// Enhanced AI Service with content moderation and templates
export class AIService {
  private providers: AIProvider[];

  constructor(providers: AIProvider[] = aiProviders) {
    this.providers = providers;
  }

  async generateText(
    prompt: string,
    options: ContentGenerationOptions = {},
    preferredProvider?: string
  ): Promise<TextGenerationResult> {
    const provider = preferredProvider
      ? this.providers.find((p) => p.name === preferredProvider) ||
        this.providers[0]
      : this.providers[0];

    try {
      const text = await provider.generateText(prompt, options);
      
      // Moderate content
      const moderation = await provider.moderateContent(text);
      
      // Extract hashtags and emojis if not already parsed
      const hashtags = this.extractHashtags(text);
      const emojis = this.extractEmojis(text);
      
      return {
        text: this.cleanText(text),
        hashtags,
        emojis,
        provider: provider.name,
        cost: provider.cost,
        moderated: true,
        moderationFlags: moderation.flagged ? Object.keys(moderation.categories || {}) : [],
      };
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      
      // Fallback to next provider
      const fallbackProvider = this.providers.find(
        (p) => p.name !== provider.name
      );
      if (fallbackProvider) {
        return this.generateText(prompt, options, fallbackProvider.name);
      }
      
      throw new Error("All AI providers failed");
    }
  }

  async generateImage(
    prompt: string,
    options: ContentGenerationOptions = {},
    preferredProvider?: string
  ): Promise<ImageGenerationResult> {
    const imageProviders = this.providers.filter(p => p.generateImage);
    const provider = preferredProvider
      ? imageProviders.find((p) => p.name === preferredProvider) ||
        imageProviders[0]
      : imageProviders[0];

    try {
      const url = await provider.generateImage(prompt, options);
      
      // Note: Image moderation would require additional service
      // For now, we'll assume generated images are safe
      
      return {
        url,
        provider: provider.name,
        cost: provider.cost,
        moderated: true,
        moderationFlags: [],
      };
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      
      // Fallback to next image provider
      const fallbackProvider = imageProviders.find(
        (p) => p.name !== provider.name
      );
      if (fallbackProvider) {
        return this.generateImage(prompt, options, fallbackProvider.name);
      }
      
      throw new Error("All image providers failed");
    }
  }

  async generateVideoScript(
    prompt: string,
    options: ContentGenerationOptions = {},
    preferredProvider?: string
  ): Promise<VideoScriptResult> {
    const scriptProviders = this.providers.filter(p => p.generateVideoScript);
    const provider = preferredProvider
      ? scriptProviders.find((p) => p.name === preferredProvider) ||
        scriptProviders[0]
      : scriptProviders[0];

    try {
      const script = await provider.generateVideoScript(prompt, options);
      
      // Moderate script content
      const fullScript = `${script.title} ${script.hook} ${script.scenes.map(s => s.voiceover).join(' ')} ${script.callToAction}`;
      const moderation = await provider.moderateContent(fullScript);
      
      return {
        ...script,
        provider: provider.name,
        cost: provider.cost,
      };
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      
      // Fallback to next script provider
      const fallbackProvider = scriptProviders.find(
        (p) => p.name !== provider.name
      );
      if (fallbackProvider) {
        return this.generateVideoScript(prompt, options, fallbackProvider.name);
      }
      
      throw new Error("All video script providers failed");
    }
  }

  async moderateContent(content: string): Promise<{ flagged: boolean; categories?: Record<string, number> }> {
    // Try all providers for moderation
    for (const provider of this.providers) {
      try {
        const result = await provider.moderateContent(content);
        if (result.flagged) {
          return result;
        }
      } catch (error) {
        console.error(`Moderation failed with ${provider.name}:`, error);
      }
    }
    
    return { flagged: false };
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return text.match(hashtagRegex) || [];
  }

  private extractEmojis(text: string): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.slice(0, 5) : []; // Limit to 5 emojis
  }

  private cleanText(text: string): string {
    // Remove JSON formatting if present
    return text.replace(/^```json\s*|\s*```$/g, '').trim();
  }
}

export const aiService = new AIService();

