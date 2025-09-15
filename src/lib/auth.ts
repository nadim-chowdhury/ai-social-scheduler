import { NextAuthOptions } from "next-auth";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import { supabaseAdmin } from "./supabase";

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider !== "email") {
          // For OAuth providers, update user info from profile
          if (user.id && profile) {
            await supabaseAdmin
              .from("users")
              .upsert({
                id: user.id,
                email: user.email!,
                name: user.name || profile.name || user.email?.split("@")[0],
                avatar_url: user.image || (profile as any)?.picture || (profile as any)?.avatar_url,
              }, {
                onConflict: "id",
              });
          }
        }
        return true;
      } catch (error) {
        console.error("Sign in callback error:", error);
        return true; // Don't block sign in
      }
    },
    async session({ session, user }) {
      if (session?.user && user) {
        session.user.id = user.id;
        
        // Get user's workspaces
        try {
          const { data: workspaces } = await supabaseAdmin
            .from("workspace_members")
            .select(`
              workspace_id,
              role,
              workspaces!inner(
                id,
                name,
                owner_id,
                plan
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

          const transformedWorkspaces = workspaces?.map((item) => ({
            id: item.workspaces.id,
            name: item.workspaces.name,
            owner_id: item.workspaces.owner_id,
            plan: item.workspaces.plan,
            role: item.role,
          })) || [];

          (session.user as any).workspaces = transformedWorkspaces;
          
          // Set current workspace (first one or create default)
          if (transformedWorkspaces.length > 0) {
            (session.user as any).currentWorkspace = transformedWorkspaces[0];
          } else {
            // Create default workspace for new users
            const { data: newWorkspace } = await supabaseAdmin
              .from("workspaces")
              .insert({
                name: `${user.name || user.email?.split("@")[0]}'s Workspace`,
                owner_id: user.id,
                plan: "free",
              })
              .select()
              .single();

            if (newWorkspace) {
              await supabaseAdmin
                .from("workspace_members")
                .insert({
                  workspace_id: newWorkspace.id,
                  user_id: user.id,
                  role: "owner",
                });

              (session.user as any).currentWorkspace = {
                id: newWorkspace.id,
                name: newWorkspace.name,
                owner_id: newWorkspace.owner_id,
                plan: newWorkspace.plan,
                role: "owner",
              };
              (session.user as any).workspaces = [(session.user as any).currentWorkspace];
            }
          }
        } catch (error) {
          console.error("Session callback error:", error);
        }
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      
      // Update token if session is updated
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }
      
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      // This event is triggered when a new user is created
      console.log("New user created:", user.id);
    },
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
  session: {
    strategy: "database",
  },
};

// Helper function to get user's workspace access
export async function getUserWorkspaceAccess(userId: string, workspaceId: string) {
  const { data: member, error } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !member) {
    return null;
  }

  return member.role;
}

// Helper function to check if user has permission
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = ["viewer", "editor", "admin", "owner"];
  const userIndex = roleHierarchy.indexOf(userRole);
  const requiredIndex = roleHierarchy.indexOf(requiredRole);
  
  return userIndex >= requiredIndex;
}
