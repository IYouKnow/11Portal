import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { usePortalData } from "./hooks/usePortalData";
import { ThemeProvider } from "./theme";

export default function App() {
  const {
    initialized,
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

  let content: JSX.Element;

  if (!initialized) {
    content = (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
        <div className="absolute inset-0 bg-portal-grid bg-[length:36px_36px] opacity-20" />
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

        <section className="relative w-full max-w-md rounded-3xl border border-line bg-panel/90 p-8 text-center shadow-soft backdrop-blur">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Restoring your session
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Checking your access and loading Nortem Portal.
          </p>
        </section>
      </main>
    );
  } else if (!user || !overview) {
    content = (
      <LoginScreen
        loading={loading}
        error={error}
        onSubmit={signIn}
      />
    );
  } else {
    content = (
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

  return (
    <ThemeProvider userId={user?.id ?? null}>
      {content}
    </ThemeProvider>
  );
}
