import type { Overview, User } from "../../lib/api";

type DashboardHeaderProps = {
  activeWorkspace: string;
  user: User;
  isAdmin: boolean;
  onRefresh: () => void;
  onLogout: () => void;
};

export function DashboardHeader({
  activeWorkspace,
  user,
  isAdmin,
  onRefresh,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-lg font-medium text-ink">{activeWorkspace}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted sm:flex">
          <span className="text-ink">{user.email}</span>
          <span
            className={`rounded-full px-2 py-0.5 uppercase tracking-[0.22em] ${
              isAdmin
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-sky-500/15 text-sky-200"
            }`}
          >
            {user.role}
          </span>
        </div>
        <button
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink transition hover:bg-white/10"
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-muted transition hover:text-ink"
          onClick={onLogout}
          type="button"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
