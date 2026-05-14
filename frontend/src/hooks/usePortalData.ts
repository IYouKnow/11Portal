import { useEffect, useState } from "react";
import {
  createUser,
  getCurrentUser,
  getOverview,
  getWorkspaces,
  login,
  listUsers,
  logout,
  type Overview,
  type User,
  type Workspace,
} from "../lib/api";

type PortalState = {
  initialized: boolean;
  loading: boolean;
  user: User | null;
  overview: Overview | null;
  workspaces: Workspace[];
  users: User[];
  error: string | null;
};

const initialState: PortalState = {
  initialized: false,
  loading: true,
  user: null,
  overview: null,
  workspaces: [],
  users: [],
  error: null,
};

export function usePortalData() {
  const [state, setState] = useState<PortalState>(initialState);

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [{ user }, overview, workspaces] = await Promise.all([
        getCurrentUser(),
        getOverview(),
        getWorkspaces(),
      ]);

      const users =
        user.role === "admin" ? (await listUsers()).items : [];

      setState({
        initialized: true,
        loading: false,
        user,
        overview,
        workspaces: workspaces.items,
        users,
        error: null,
      });
    } catch {
      setState({
        initialized: true,
        loading: false,
        user: null,
        overview: null,
        workspaces: [],
        users: [],
        error: null,
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signIn = async (email: string, password: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      await login(email, password);
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Sign in failed",
      }));
    }
  };

  const signOut = async () => {
    await logout();
    setState({
      initialized: true,
      loading: false,
      user: null,
      overview: null,
      workspaces: [],
      users: [],
      error: null,
    });
  };

  const createManagedUser = async (
    email: string,
    password: string,
    role: User["role"],
  ) => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      await createUser(email, password, role);
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "User creation failed",
      }));
      throw error;
    }
  };

  return {
    ...state,
    refresh,
    signIn,
    signOut,
    createManagedUser,
  };
}
