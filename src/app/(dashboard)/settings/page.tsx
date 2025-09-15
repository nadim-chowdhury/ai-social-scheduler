"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { WorkspaceSettings } from "@/components/dashboard/workspace-settings";
import { TeamManagement } from "@/components/dashboard/team-management";
import { SocialConnections } from "@/components/dashboard/social-connections";
import { setCurrentWorkspace, updateWorkspace, removeWorkspace } from "@/store/slices/userSlice";
import { useDispatch } from "react-redux";
import { Workspace } from "@/store/slices/userSlice";

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { currentWorkspace } = useSelector((state: RootState) => state.user);

  const handleWorkspaceUpdate = (workspace: Workspace) => {
    dispatch(updateWorkspace({ id: workspace.id, updates: workspace }));
    dispatch(setCurrentWorkspace(workspace));
  };

  const handleWorkspaceDelete = (workspaceId: string) => {
    dispatch(removeWorkspace(workspaceId));
    // Redirect to dashboard or another workspace
    window.location.href = "/dashboard";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, workspace, team, and social media connections.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {currentWorkspace && (
            <>
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="social">Social Accounts</TabsTrigger>
              {["owner", "admin"].includes(currentWorkspace.role) && (
                <TabsTrigger value="team">Team</TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSettings />
        </TabsContent>

        {currentWorkspace && (
          <>
            <TabsContent value="workspace" className="space-y-6">
              <WorkspaceSettings
                workspace={currentWorkspace}
                onWorkspaceUpdate={handleWorkspaceUpdate}
                onWorkspaceDelete={handleWorkspaceDelete}
              />
            </TabsContent>

            <TabsContent value="social" className="space-y-6">
              <SocialConnections
                workspaceId={currentWorkspace.id}
                userRole={currentWorkspace.role}
              />
            </TabsContent>

            {["owner", "admin"].includes(currentWorkspace.role) && (
              <TabsContent value="team" className="space-y-6">
                <TeamManagement
                  workspaceId={currentWorkspace.id}
                  userRole={currentWorkspace.role}
                />
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
