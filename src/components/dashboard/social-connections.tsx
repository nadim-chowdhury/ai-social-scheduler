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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Link,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Music,
  Loader2,
} from "lucide-react";

interface SocialAccount {
  id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string;
  name: string;
  is_active: boolean;
  connected_at: string;
  token_expires_at?: string;
  is_token_valid: boolean;
  token_expires_in?: number;
}

interface SocialConnectionsProps {
  workspaceId: string;
  userRole: string;
}

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case "facebook":
      return <Facebook className="h-4 w-4" />;
    case "instagram":
      return <Instagram className="h-4 w-4" />;
    case "twitter":
      return <Twitter className="h-4 w-4" />;
    case "linkedin":
      return <Linkedin className="h-4 w-4" />;
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "tiktok":
      return <Music className="h-4 w-4" />;
    default:
      return <Link className="h-4 w-4" />;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case "facebook":
      return "text-blue-600";
    case "instagram":
      return "text-pink-600";
    case "twitter":
      return "text-blue-400";
    case "linkedin":
      return "text-blue-700";
    case "youtube":
      return "text-red-600";
    case "tiktok":
      return "text-black";
    default:
      return "text-gray-600";
  }
};

const formatTokenExpiry = (expiresIn: number) => {
  if (expiresIn <= 0) return "Expired";
  
  const days = Math.floor(expiresIn / (24 * 60 * 60));
  const hours = Math.floor((expiresIn % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((expiresIn % (60 * 60)) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export function SocialConnections({ workspaceId, userRole }: SocialConnectionsProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<SocialAccount | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const canManageAccounts = ["owner", "admin", "editor"].includes(userRole);

  useEffect(() => {
    fetchAccounts();
  }, [workspaceId]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`/api/social/accounts?workspaceId=${workspaceId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch accounts");
      }

      setAccounts(result.data);
    } catch (error) {
      console.error("Fetch accounts error:", error);
      toast.error("Failed to fetch social accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    try {
      const response = await fetch("/api/social/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          workspaceId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to initiate connection");
      }

      // Redirect to OAuth flow
      window.location.href = result.data.authUrl;
    } catch (error) {
      console.error("Connect error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect account");
    }
  };

  const handleDisconnect = async () => {
    if (!accountToDisconnect || !canManageAccounts) return;

    setIsDisconnecting(true);

    try {
      const response = await fetch(`/api/social/accounts/${accountToDisconnect.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to disconnect account");
      }

      setAccounts(accounts.filter(account => account.id !== accountToDisconnect.id));
      setDisconnectDialogOpen(false);
      setAccountToDisconnect(null);
      toast.success("Account disconnected successfully");
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disconnect account");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshToken = async (accountId: string) => {
    try {
      const response = await fetch(`/api/social/accounts/${accountId}/refresh`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to refresh token");
      }

      // Refresh the accounts list
      await fetchAccounts();
      toast.success("Token refreshed successfully");
    } catch (error) {
      console.error("Refresh token error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh token");
    }
  };

  const availablePlatforms = [
    { id: "facebook", name: "Facebook", icon: <Facebook className="h-5 w-5" /> },
    { id: "instagram", name: "Instagram", icon: <Instagram className="h-5 w-5" /> },
    { id: "twitter", name: "Twitter/X", icon: <Twitter className="h-5 w-5" /> },
    { id: "linkedin", name: "LinkedIn", icon: <Linkedin className="h-5 w-5" /> },
    { id: "youtube", name: "YouTube", icon: <Youtube className="h-5 w-5" /> },
    { id: "tiktok", name: "TikTok", icon: <Music className="h-5 w-5" /> },
  ];

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
                <Link className="h-5 w-5" />
                Social Media Accounts
              </CardTitle>
              <CardDescription>
                Connect and manage your social media accounts for content publishing.
              </CardDescription>
            </div>
            {canManageAccounts && (
              <div className="flex gap-2">
                {availablePlatforms.map((platform) => (
                  <Button
                    key={platform.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(platform.id)}
                    className="flex items-center gap-2"
                  >
                    {platform.icon}
                    {platform.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className={getPlatformColor(account.platform)}>
                          {getPlatformIcon(account.platform)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          @{account.platform_username}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {account.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={account.is_active ? "default" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {account.is_active ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={account.is_token_valid ? "default" : "destructive"}
                        className="flex items-center gap-1"
                      >
                        {account.is_token_valid ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {account.is_token_valid ? "Valid" : "Invalid"}
                      </Badge>
                      {account.token_expires_in && (
                        <span className="text-xs text-muted-foreground">
                          {formatTokenExpiry(account.token_expires_in)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(account.connected_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManageAccounts && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!account.is_token_valid && (
                            <DropdownMenuItem
                              onClick={() => handleRefreshToken(account.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh Token
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setAccountToDisconnect(account);
                              setDisconnectDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {accounts.length === 0 && (
            <div className="text-center py-8">
              <Link className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No connected accounts</h3>
              <p className="text-muted-foreground mb-4">
                Connect your social media accounts to start publishing content.
              </p>
              {canManageAccounts && (
                <div className="flex gap-2 justify-center">
                  {availablePlatforms.slice(0, 3).map((platform) => (
                    <Button
                      key={platform.id}
                      variant="outline"
                      onClick={() => handleConnect(platform.id)}
                      className="flex items-center gap-2"
                    >
                      {platform.icon}
                      {platform.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{" "}
              <strong>{accountToDisconnect?.name}</strong>? This will prevent
              future posts from being published to this account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
