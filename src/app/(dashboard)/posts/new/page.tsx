"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Zap, Image, Save, Send } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  platform: z.string().min(1, "Platform is required"),
  socialAccountId: z.string().min(1, "Social account is required"),
  scheduledAt: z.date().optional(),
  isScheduled: z.boolean().default(false),
});

type PostFormData = z.infer<typeof postSchema>;

export default function NewPostPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      isScheduled: false,
    },
  });

  const isScheduled = watch("isScheduled");

  // Mock social accounts - replace with real data
  const socialAccounts = [
    {
      id: "1",
      platform: "facebook",
      name: "My Facebook Page",
      username: "@mycompany",
    },
    {
      id: "2",
      platform: "instagram",
      name: "My Instagram",
      username: "@mycompany",
    },
    {
      id: "3",
      platform: "twitter",
      name: "My Twitter",
      username: "@mycompany",
    },
  ];

  const handleAIGenerate = async (type: "text" | "image") => {
    setIsGenerating(true);
    try {
      // Mock AI generation - replace with real API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (type === "text") {
        setGeneratedContent(
          "This is AI-generated content that would replace the current content. It includes engaging copy, relevant hashtags, and a call-to-action! #AI #SocialMedia #Marketing"
        );
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (data: PostFormData) => {
    try {
      console.log("Post data:", data);
      // Handle form submission
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
        <p className="text-gray-600">
          Create and schedule your social media content
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Post Content */}
            <Card>
              <CardHeader>
                <CardTitle>Post Content</CardTitle>
                <CardDescription>
                  Write your post content or use AI to generate it
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter post title..."
                    {...register("title")}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content">Content</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAIGenerate("text")}
                        disabled={isGenerating}
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        {isGenerating ? "Generating..." : "AI Generate"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAIGenerate("image")}
                        disabled={isGenerating}
                      >
                        <Image className="mr-2 h-4 w-4" />
                        Generate Image
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="content"
                    placeholder="Write your post content..."
                    rows={6}
                    {...register("content")}
                  />
                  {errors.content && (
                    <p className="text-sm text-red-600">
                      {errors.content.message}
                    </p>
                  )}

                  {generatedContent && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800 mb-2">
                        AI Generated Content:
                      </p>
                      <p className="text-sm text-blue-700">
                        {generatedContent}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setValue("content", generatedContent)}
                      >
                        Use This Content
                      </Button>
                    </div>
                  )}
                </div>

                {/* Media Upload */}
                <div className="space-y-2">
                  <Label>Media</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Image className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Drag and drop images here, or click to select
                    </p>
                    <Button type="button" variant="outline" className="mt-2">
                      Select Files
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Platform & Account */}
            <Card>
              <CardHeader>
                <CardTitle>Platform & Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    onValueChange={(value) => setValue("platform", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.platform && (
                    <p className="text-sm text-red-600">
                      {errors.platform.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialAccount">Account</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue("socialAccountId", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {socialAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.socialAccountId && (
                    <p className="text-sm text-red-600">
                      {errors.socialAccountId.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scheduling */}
            <Card>
              <CardHeader>
                <CardTitle>Scheduling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isScheduled">Schedule Post</Label>
                  <Switch
                    id="isScheduled"
                    checked={isScheduled}
                    onCheckedChange={(checked) =>
                      setValue("isScheduled", checked)
                    }
                  />
                </div>

                {isScheduled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {selectedDate
                              ? format(selectedDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              setSelectedDate(date);
                              if (date) setValue("scheduledAt", date);
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save as Draft"}
                </Button>

                {isScheduled ? (
                  <Button type="submit" variant="default" className="w-full">
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule Post
                  </Button>
                ) : (
                  <Button type="submit" variant="default" className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    Post Now
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
