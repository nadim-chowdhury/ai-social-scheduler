import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan: "free" | "pro" | "agency";
  role: "owner" | "admin" | "editor" | "viewer";
  ai_credits_used?: number;
  ai_credits_limit?: number;
  created_at?: string;
  updated_at?: string;
  member_since?: string;
}

export interface WorkspaceMember {
  id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joined_at: string;
  user: User;
}

interface UserState {
  currentUser: User | null;
  users: User[];
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspaceMembers: WorkspaceMember[];
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  currentUser: null,
  users: [],
  workspaces: [],
  currentWorkspace: null,
  workspaceMembers: [],
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // User actions
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
    },
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    addUser: (state, action: PayloadAction<User>) => {
      state.users.push(action.payload);
    },
    updateUser: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<User> }>
    ) => {
      const { id, updates } = action.payload;
      const userIndex = state.users.findIndex((user) => user.id === id);
      if (userIndex !== -1) {
        state.users[userIndex] = { ...state.users[userIndex], ...updates };
      }
      if (state.currentUser?.id === id) {
        state.currentUser = { ...state.currentUser, ...updates };
      }
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter((user) => user.id !== action.payload);
      if (state.currentUser?.id === action.payload) {
        state.currentUser = null;
      }
    },

    // Workspace actions
    setWorkspaces: (state, action: PayloadAction<Workspace[]>) => {
      state.workspaces = action.payload;
    },
    addWorkspace: (state, action: PayloadAction<Workspace>) => {
      state.workspaces.push(action.payload);
    },
    updateWorkspace: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Workspace> }>
    ) => {
      const { id, updates } = action.payload;
      const workspaceIndex = state.workspaces.findIndex((ws) => ws.id === id);
      if (workspaceIndex !== -1) {
        state.workspaces[workspaceIndex] = {
          ...state.workspaces[workspaceIndex],
          ...updates,
        };
      }
      if (state.currentWorkspace?.id === id) {
        state.currentWorkspace = { ...state.currentWorkspace, ...updates };
      }
    },
    removeWorkspace: (state, action: PayloadAction<string>) => {
      state.workspaces = state.workspaces.filter((ws) => ws.id !== action.payload);
      if (state.currentWorkspace?.id === action.payload) {
        state.currentWorkspace = state.workspaces[0] || null;
      }
    },
    setCurrentWorkspace: (state, action: PayloadAction<Workspace | null>) => {
      state.currentWorkspace = action.payload;
    },

    // Workspace members actions
    setWorkspaceMembers: (state, action: PayloadAction<WorkspaceMember[]>) => {
      state.workspaceMembers = action.payload;
    },
    addWorkspaceMember: (state, action: PayloadAction<WorkspaceMember>) => {
      state.workspaceMembers.push(action.payload);
    },
    updateWorkspaceMember: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<WorkspaceMember> }>
    ) => {
      const { id, updates } = action.payload;
      const memberIndex = state.workspaceMembers.findIndex((member) => member.id === id);
      if (memberIndex !== -1) {
        state.workspaceMembers[memberIndex] = {
          ...state.workspaceMembers[memberIndex],
          ...updates,
        };
      }
    },
    removeWorkspaceMember: (state, action: PayloadAction<string>) => {
      state.workspaceMembers = state.workspaceMembers.filter(
        (member) => member.id !== action.payload
      );
    },

    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentUser,
  setUsers,
  addUser,
  updateUser,
  removeUser,
  setWorkspaces,
  addWorkspace,
  updateWorkspace,
  removeWorkspace,
  setCurrentWorkspace,
  setWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMember,
  removeWorkspaceMember,
  setLoading,
  setError,
  clearError,
} = userSlice.actions;

export default userSlice.reducer;
