import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getOverview,
  getWorkspaces,
  login,
  logout,
  type Overview,
  type User,
  type Workspace,
} from "../lib/api";

type PortalState = {
  loading: boolean;
  user: User | null;
  overview: Overview | null;
  workspaces: Workspace[];
  error: string | null;
};

const initialState: PortalState = {
  loading: true,
  user: null,
  overview: null,
  workspaces: [],
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

      setState({
        loading: false,
        user,
        overview,
        workspaces: workspaces.items,
        error: null,
      });
    } catch {
      setState({
        loading: false,
        user: null,
        overview: null,
        workspaces: [],
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
      loading: false,
      user: null,
      overview: null,
      workspaces: [],
      error: null,
    });
  };

  return {
    ...state,
    refresh,
    signIn,
    signOut,
  };
}

