import { FormEvent, useState } from "react";

type LoginScreenProps = {
  loading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
};

export function LoginScreen({ loading, error, onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute inset-0 bg-portal-grid bg-[length:36px_36px] opacity-20" />
      <div className="absolute inset-x-0 top-[-10rem] mx-auto h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-line bg-panel/90 p-8 shadow-soft backdrop-blur">
        <div className="mb-8">
          <div className="mb-4 inline-flex rounded-full border border-line bg-surface/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-muted">
            Portal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Secure portal access.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Sign in with credentials issued by an administrator. Registration is
            disabled, and access is managed through `user` and `admin` roles.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Email</span>
            <input
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-muted">Password</span>
            <input
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Enter Portal"}
          </button>
        </form>
      </section>
    </main>
  );
}
