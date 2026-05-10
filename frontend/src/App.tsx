import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { usePortalData } from "./hooks/usePortalData";

export default function App() {
  const { loading, user, overview, workspaces, error, refresh, signIn, signOut } =
    usePortalData();

  if (!user || !overview) {
    return (
      <LoginScreen
        loading={loading}
        error={error}
        onSubmit={signIn}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      overview={overview}
      workspaces={workspaces}
      onRefresh={refresh}
      onLogout={signOut}
    />
  );
}
