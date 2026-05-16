import type { AppID } from "./types";

export function AppIcon({ appId }: { appId: AppID }) {
  if (appId === "chromium") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect x="7" y="10" width="34" height="28" rx="8" fill="#0F172A" stroke="#7DD3FC" strokeWidth="2" />
        <path d="M7 18h34" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
        <circle cx="13" cy="14" r="1.4" fill="#F87171" />
        <circle cx="18" cy="14" r="1.4" fill="#FBBF24" />
        <circle cx="23" cy="14" r="1.4" fill="#34D399" />
        <circle cx="24" cy="28" r="7" stroke="#E0F2FE" strokeWidth="2" />
        <path
          d="M17 28h14M24 21c2.3 2 3.5 4.33 3.5 7S26.3 33 24 35c-2.3-2-3.5-4.33-3.5-7S21.7 23 24 21Z"
          stroke="#E0F2FE"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (appId === "terminal") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect x="7" y="9" width="34" height="30" rx="7" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
        <path d="m16 18 6 6-6 6" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25 30h8" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (appId === "remoteDesktop") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="9" width="24" height="18" rx="4.5" fill="#0F172A" stroke="#67E8F9" strokeWidth="2" />
        <rect x="18" y="21" width="24" height="18" rx="4.5" fill="#111827" stroke="#22C55E" strokeWidth="2" />
        <path d="M12 31h10" stroke="#E5F9FF" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24 17h7" stroke="#C7F9CC" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m26 30 3 3 6-6" stroke="#86EFAC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="32" height="32" rx="8" fill="#111827" stroke="#A78BFA" strokeWidth="2" />
      <circle cx="24" cy="24" r="7" stroke="#E9D5FF" strokeWidth="2.5" />
      <path
        d="M24 13v4M24 31v4M35 24h-4M17 24h-4M31.8 16.2l-2.8 2.8M19 29l-2.8 2.8M31.8 31.8 29 29M19 19l-2.8-2.8"
        stroke="#E9D5FF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
