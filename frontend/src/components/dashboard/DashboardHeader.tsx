import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, RefreshCw, UserRound } from "lucide-react";
import type { User } from "../../lib/api";

type DashboardHeaderProps = {
  user: User;
  isAdmin: boolean;
  onRefresh: () => void;
  onLogout: () => void;
};

export function DashboardHeader({
  user,
  isAdmin,
  onRefresh,
  onLogout,
}: DashboardHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const menu = userMenuRef.current;
      if (menu && !menu.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleRefresh = () => {
    setIsUserMenuOpen(false);
    onRefresh();
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    onLogout();
  };

  return (
    <header className="relative z-20 w-full px-4 pt-4">
      <div className="mx-auto flex max-w-[88rem] justify-center">
        <div className="flex w-full flex-col gap-3 rounded-[2rem] border border-line/70 bg-panel/70 px-4 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-panel/55 dark:shadow-[0_18px_60px_rgba(2,6,23,0.28)] sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface/80 text-ink dark:bg-white/5">
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 4.25c4.26 0 7.75 3.49 7.75 7.75S16.26 19.75 12 19.75 4.25 16.26 4.25 12 7.74 4.25 12 4.25Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 7.25c2.63 0 4.75 2.12 4.75 4.75S14.63 16.75 12 16.75 7.25 14.63 7.25 12 9.37 7.25 12 7.25Z"
                  stroke="currentColor"
                  strokeOpacity="0.55"
                  strokeWidth="1.2"
                />
                <path
                  d="M12 10.25a1.75 1.75 0 1 1 0 3.5a1.75 1.75 0 0 1 0-3.5Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                Nortem Portal
              </p>
              <p className="truncate text-sm font-medium text-ink sm:text-base">
                Secure desktop workspace
              </p>
            </div>
          </div>

          <div ref={userMenuRef} className="relative flex shrink-0 justify-start sm:justify-end">
            <button
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label="Open user menu"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/75 px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface dark:bg-white/5 dark:hover:bg-white/10"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              type="button"
            >
              <UserRound className="h-4 w-4" />
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isUserMenuOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-56 overflow-hidden rounded-2xl border border-line bg-panel/95 p-2 shadow-[0_18px_42px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                role="menu"
              >
                <div className="px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                    Account
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {user.email}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {isAdmin ? "Administrator" : "User"}
                  </p>
                </div>

                <div className="my-1 h-px bg-line/70" />

                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
                  onClick={handleRefresh}
                  type="button"
                  role="menuitem"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
                  onClick={handleLogout}
                  type="button"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
