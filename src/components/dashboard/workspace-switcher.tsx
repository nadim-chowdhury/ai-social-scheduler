"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronsUpDown,
  Plus,
  Check,
  Crown,
  Shield,
  Edit3,
  Eye,
  Loader2,
} from "lucide-react";
import { Workspace } from "@/store/slices/userSlice";

interface WorkspaceSwitcherProps {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  onWorkspaceChange: (workspace: Workspace) => void;
  onWorkspaceCreate: (workspace: Workspace) => void;
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
      return null;
  }
};

export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  onWorkspaceCreate,
}: WorkspaceSwitcherProps) {
  const { data: session } = useSession();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspacePlan, setNewWorkspacePlan] = useState<string>("free");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          plan: newWorkspacePlan,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create workspace");
      }

      onWorkspaceCreate(result.data);
      setCreateDialogOpen(false);
      setNewWorkspaceName("");
      setNewWorkspacePlan("free");
      toast.success("Workspace created successfully");
    } catch (error) {
      console.error("Create workspace error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-muted rounded-md animate-pulse" />
        <div className="w-24 h-4 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[200px] justify-between"
        >
          <div className="flex items-center space-x-2 truncate">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{currentWorkspace.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px] p-0">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Your Workspaces
        </DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => onWorkspaceChange(workspace)}
            className="flex items-center space-x-2 p-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {workspace.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <div className="flex items-center space-x-1">
                <span className="truncate text-sm">{workspace.name}</span>
                {workspace.id === currentWorkspace.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex items-center space-x-1">
                {getRoleIcon(workspace.role)}
                <span className="text-xs text-muted-foreground">{workspace.role}</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {workspace.plan}
                </Badge>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center space-x-2 p-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a new workspace to organize your social media accounts and content.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateWorkspace}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="My Awesome Workspace"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-plan">Plan</Label>
                  <Select value={newWorkspacePlan} onValueChange={setNewWorkspacePlan}>
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
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Workspace
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}