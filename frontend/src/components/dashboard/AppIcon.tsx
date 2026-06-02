import type { AppID } from "./types";

export function AppIcon({ appId }: { appId: AppID }) {
  if (appId === "chromium") {
    return (
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="7.5" />
        <path d="M4.9 9.5h14.2" />
        <path d="M12 4.5c2.4 2.1 3.6 4.6 3.6 7.5S14.4 17.4 12 19.5c-2.4-2.1-3.6-4.6-3.6-7.5S9.6 6.6 12 4.5Z" />
      </svg>
    );
  }

  if (appId === "terminal") {
    return (
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 8 4 4-4 4" />
        <path d="M13 16h5" />
        <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      </svg>
    );
  }

  if (appId === "remoteDesktop") {
    return (
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="5" width="9" height="6.5" rx="1.8" />
        <rect x="11.5" y="12.5" width="9" height="6.5" rx="1.8" />
        <path d="M8 14.5h3" />
        <path d="m15 16 1.6 1.6L19.5 15" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3.75v2.5M12 17.75v2.5M20.25 12h-2.5M6.25 12h-2.5M17.83 6.17l-1.76 1.76M7.93 16.07l-1.76 1.76M17.83 17.83l-1.76-1.76M7.93 7.93 6.17 6.17" />
    </svg>
  );
}
