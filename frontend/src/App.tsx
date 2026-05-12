import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { usePortalData } from "./hooks/usePortalData";

export default function App() {
  const {
    loading,
    user,
    overview,
    workspaces,
    users,
    error,
    refresh,
    signIn,
    signOut,
    createManagedUser,
  } =
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
      users={users}
      error={error}
      onRefresh={refresh}
      onLogout={signOut}
      onCreateUser={createManagedUser}
    />
  );
}
