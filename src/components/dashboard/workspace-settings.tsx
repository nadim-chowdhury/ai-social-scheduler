"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Settings,
  Plus,
  Trash2,
  Users,
  Crown,
  Shield,
  Edit3,
  Eye,
  Loader2,
} from "lucide-react";
import { Workspace } from "@/store/slices/userSlice";

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onWorkspaceUpdate: (workspace: Workspace) => void;
  onWorkspaceDelete: (workspaceId: string) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "owner":
      return <Crown className="h-4 w-4" />;
    case "admin":
      return <Shield className="h-4 w-4" />;
    case "editor":
      return <Edit3 className="h-4 w-4" />;
    case "viewer":
      return <Eye className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    case "editor":
      return "outline";
    case "viewer":
      return "outline";
    default:
      return "outline";
  }
};

export function WorkspaceSettings({
  workspace,
  onWorkspaceUpdate,
  onWorkspaceDelete,
}: WorkspaceSettingsProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [plan, setPlan] = useState(workspace.plan);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const canEdit = ["owner", "admin"].includes(workspace.role);
  const canDelete = workspace.role === "owner";

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          plan,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update workspace");
      }

      onWorkspaceUpdate(result.data);
      toast.success("Workspace updated successfully");
    } catch (error) {
      console.error("Update workspace error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update workspace");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!canDelete || deleteConfirmText !== workspace.name) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete workspace");
      }

      onWorkspaceDelete(workspace.id);
      setDeleteDialogOpen(false);
      toast.success("Workspace deleted successfully");
    } catch (error) {
      console.error("Delete workspace error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete workspace");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workspace Settings
          </CardTitle>
          <CardDescription>
            Manage your workspace settings and configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{workspace.name}</h3>
              <p className="text-sm text-muted-foreground">
                Created on {new Date(workspace.created_at || Date.now()).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(workspace.role)} className="flex items-center gap-1">
                {getRoleIcon(workspace.role)}
                {workspace.role}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {workspace.plan}
              </Badge>
            </div>
          </div>

          <Separator />

          <form onSubmit={handleUpdateWorkspace} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  type="text"
                  placeholder="Enter workspace name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select value={plan} onValueChange={setPlan} disabled={!canEdit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {workspace.ai_credits_limit && (
              <div className="space-y-2">
                <Label>AI Credits</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (workspace.ai_credits_used || 0) / workspace.ai_credits_limit * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {workspace.ai_credits_used || 0} / {workspace.ai_credits_limit}
                  </span>
                </div>
              </div>
            )}

            {canEdit && (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Workspace
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this workspace and all associated data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Workspace</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete the{" "}
                    <strong>{workspace.name}</strong> workspace and all associated data including
                    posts, analytics, and social accounts.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm">
                      Type <strong>{workspace.name}</strong> to confirm:
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={workspace.name}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteWorkspace}
                    disabled={isLoading || deleteConfirmText !== workspace.name}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Workspace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}