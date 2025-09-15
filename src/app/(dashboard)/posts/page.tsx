"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import Link from "next/link";

// Mock data - replace with real data from API
const mockPosts = [
  {
    id: "1",
    title: "Product Launch Announcement",
    content: "Excited to announce our new product! 🚀 #launch #innovation",
    platform: "facebook",
    status: "scheduled",
    scheduledAt: "2024-01-15T10:00:00Z",
    createdAt: "2024-01-10T09:00:00Z",
    reach: 1250,
    engagement: 45,
  },
  {
    id: "2",
    title: "Behind the Scenes",
    content: "Take a look at our team working hard on the next big thing! 💪",
    platform: "instagram",
    status: "posted",
    scheduledAt: null,
    createdAt: "2024-01-08T14:30:00Z",
    postedAt: "2024-01-12T15:00:00Z",
    reach: 2100,
    engagement: 78,
  },
  {
    id: "3",
    title: "Industry Insights",
    content: "5 trends shaping the future of social media marketing...",
    platform: "linkedin",
    status: "draft",
    scheduledAt: null,
    createdAt: "2024-01-14T11:20:00Z",
    reach: 0,
    engagement: 0,
  },
];

export default function PostsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const filteredPosts = mockPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || post.status === statusFilter;
    const matchesPlatform =
      platformFilter === "all" || post.platform === platformFilter;

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      scheduled: "default",
      posted: "outline",
      failed: "destructive",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPlatformIcon = (platform: string) => {
    const icons = {
      facebook: "📘",
      instagram: "📷",
      twitter: "🐦",
      linkedin: "💼",
      tiktok: "🎵",
    };
    return icons[platform as keyof typeof icons] || "📱";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-600">Manage your social media content</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/posts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <Card key={post.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getPlatformIcon(post.platform)}
                    </span>
                    <h3 className="font-semibold text-lg">{post.title}</h3>
                    {getStatusBadge(post.status)}
                  </div>
                  <p className="text-gray-600 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Created: {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    {post.scheduledAt && (
                      <span>
                        Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                      </span>
                    )}
                    {post.postedAt && (
                      <span>
                        Posted: {new Date(post.postedAt).toLocaleString()}
                      </span>
                    )}
                    {post.reach > 0 && (
                      <span>Reach: {post.reach.toLocaleString()}</span>
                    )}
                    {post.engagement > 0 && (
                      <span>Engagement: {post.engagement}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No posts found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery ||
                statusFilter !== "all" ||
                platformFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first post"}
              </p>
              <div className="mt-6">
                <Button asChild>
                  <Link href="/dashboard/posts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Post
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
