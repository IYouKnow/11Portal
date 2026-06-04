import { Settings } from "lucide-react";
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

  if (appId === "networkScanner") {
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
        <circle cx="9" cy="9" r="4.5" />
        <path d="M12.2 12.2 17 17" />
        <path d="M6.7 9h4.6" />
        <path d="M9 6.7v4.6" />
        <path d="M14.5 6.5h4" />
        <path d="M14.5 9.5h4" />
        <path d="M14.5 12.5h4" />
      </svg>
    );
  }

  if (appId === "notepad") {
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
        <path d="M7 4.5h7.2L18.5 8v11.5A2 2 0 0 1 16.5 21h-9A2 2 0 0 1 5.5 19V6.5A2 2 0 0 1 7.5 4.5Z" />
        <path d="M14.2 4.5V8h4.3" />
        <path d="M8.5 11h7" />
        <path d="M8.5 14h7" />
        <path d="M8.5 17h5.2" />
      </svg>
    );
  }

  return (
    <Settings aria-hidden="true" className="h-7 w-7" strokeWidth={1.9} />
  );
}
