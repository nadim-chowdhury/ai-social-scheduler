"use client";

import { useState, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Crown,
  Shield,
  Edit3,
  Eye,
  Trash2,
  Loader2,
  Mail,
} from "lucide-react";
import { WorkspaceMember } from "@/store/slices/userSlice";

interface TeamManagementProps {
  workspaceId: string;
  userRole: string;
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

export function TeamManagement({ workspaceId, userRole }: TeamManagementProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("editor");
  const [isInviting, setIsInviting] = useState(false);

  const canManageMembers = ["owner", "admin"].includes(userRole);

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch members");
      }

      setMembers(result.data);
    } catch (error) {
      console.error("Fetch members error:", error);
      toast.error("Failed to fetch team members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageMembers) return;

    setIsInviting(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to invite member");
      }

      setMembers([...members, result.data]);
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("editor");
      toast.success("Member invited successfully");
    } catch (error) {
      console.error("Invite member error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!canManageMembers) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update member role");
      }

      setMembers(members.map(member => 
        member.id === memberId ? result.data : member
      ));
      toast.success("Member role updated successfully");
    } catch (error) {
      console.error("Update member role error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update member role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManageMembers) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove member");
      }

      setMembers(members.filter(member => member.id !== memberId));
      toast.success("Member removed successfully");
    } catch (error) {
      console.error("Remove member error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage team members and their roles in this workspace.
              </CardDescription>
            </div>
            {canManageMembers && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join this workspace. The user must already have an
                      account.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInviteMember}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInviteDialogOpen(false)}
                        disabled={isInviting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isInviting}>
                        {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={member.user.avatar_url} />
                        <AvatarFallback>
                          {member.user.name
                            ? member.user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
                            : member.user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1 w-fit">
                      {getRoleIcon(member.role)}
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joined_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManageMembers && member.role !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleUpdateMemberRole(member.id, "admin")}
                            disabled={member.role === "admin"}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateMemberRole(member.id, "editor")}
                            disabled={member.role === "editor"}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Make Editor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateMemberRole(member.id, "viewer")}
                            disabled={member.role === "viewer"}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Make Viewer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {members.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No team members</h3>
              <p className="text-muted-foreground mb-4">
                Start collaborating by inviting team members to this workspace.
              </p>
              {canManageMembers && (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Your First Member
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}