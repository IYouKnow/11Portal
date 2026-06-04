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
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,rgba(248,251,255,1)_0%,rgba(238,243,249,1)_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(11,13,18,1)_0%,rgba(7,9,13,1)_100%)]" />
      <div className="absolute inset-0 bg-portal-grid bg-[length:36px_36px] opacity-[0.12]" />
      <div className="absolute left-1/2 top-[-8rem] h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute right-[-4rem] top-20 h-56 w-56 rounded-full bg-success/10 blur-3xl" />

      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-line bg-panel/85 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="relative hidden overflow-hidden border-r border-line/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.7),rgba(248,250,252,0.9))] p-8 text-ink dark:bg-[linear-gradient(145deg,rgba(24,24,27,0.96),rgba(17,17,19,0.9))] lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_30%)]" />
            <div className="absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.55),transparent)]" />

            <div className="relative max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-muted">
                <span className="h-2 w-2 rounded-full bg-success" />
                Nortem Portal
              </div>

              <h1 className="max-w-lg text-5xl font-semibold tracking-tight text-ink">
                Sign in to your network workspace.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted">
                Use your admin account or Nortem account to open browser, terminal,
                and remote access tools from one place.
              </p>
            </div>

            <div className="relative mt-10 rounded-3xl border border-line bg-panel/80 p-5 shadow-soft">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Access model
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                  <span className="text-lg font-semibold">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    Log in to access your network.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    This self-hosted instance opens after authentication.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full border border-line bg-surface/70 px-3 py-1.5">
                  Network access
                </span>
                <span className="rounded-full border border-line bg-surface/70 px-3 py-1.5">
                  Self-hosted
                </span>
                <span className="rounded-full border border-line bg-surface/70 px-3 py-1.5">
                  Authenticated entry
                </span>
              </div>
            </div>
          </aside>

          <section className="relative p-6 sm:p-8 lg:p-10">
            <div className="mx-auto flex max-w-lg flex-col justify-center">
              <div className="mb-7 lg:hidden">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-muted">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Nortem Portal
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Sign in to your workspace.
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Use the Nortem account for this self-hosted instance to open browser,
                  terminal, and remote access tools.
                </p>
              </div>

              <div className="mb-8 hidden lg:block">
                <p className="text-sm uppercase tracking-[0.24em] text-muted">
                  Sign in
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  Nortem account access
                </h2>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-muted">
                    Email
                  </span>
                  <input
                    className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent/70 focus:ring-4 focus:ring-accent/10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="username"
                    placeholder="you@company.com"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-muted">
                    Password
                  </span>
                  <input
                    className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent/70 focus:ring-4 focus:ring-accent/10"
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
                  className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3.5 text-sm font-medium text-accent transition hover:-translate-y-0.5 hover:bg-accent/20 hover:shadow-[0_12px_30px_rgba(14,165,233,0.18)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Enter Nortem Portal"}
                </button>
              </form>

              <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted">
                <span className="h-px flex-1 bg-line" />
                or continue with
                <span className="h-px flex-1 bg-line" />
              </div>

              <button
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  N
                </span>
                Continue with Nortem Login
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
