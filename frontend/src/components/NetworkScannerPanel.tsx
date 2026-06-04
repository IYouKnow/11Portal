import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { scanNetwork, type NetworkScanItem, type NetworkScanSummary } from "../lib/api";

type ScanState = {
  items: NetworkScanItem[];
  summary: NetworkScanSummary | null;
  lastScannedAt: string | null;
};

const initialScanState: ScanState = {
  items: [],
  summary: null,
  lastScannedAt: null,
};

export function NetworkScannerPanel() {
  const [cidrInput, setCidrInput] = useState("");
  const [state, setState] = useState<ScanState>(initialScanState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const parsedCidrs = useMemo(
    () =>
      cidrInput
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    [cidrInput],
  );

  const runScan = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await scanNetwork(parsedCidrs);
      setState({
        items: response.items,
        summary: response.summary,
        lastScannedAt: new Date().toLocaleString(),
      });
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan the network.",
      );
    } finally {
      setLoading(false);
    }
  };

  const discoveredNetworks = state.summary?.scannedCidrs ?? [];
  const skippedNetworks = state.summary?.skippedCidrs ?? [];
  const canSearch = parsedCidrs.length > 0 && !loading;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgb(var(--color-panel))_0%,rgb(var(--color-surface))_100%)] text-ink">
      <div className="border-b border-line bg-window-chrome/85 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/12 text-accent">
                <Search className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Network Scanner
                </h2>
                <p className="text-sm text-muted">
                  Discover live hosts, hostnames, and MAC addresses on the ranges your backend can see.
                </p>
              </div>
            </div>
          </div>

          <button
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-accent/30 bg-accent/12 px-4 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSearch}
            onClick={() => void runScan()}
            type="button"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form
          className="grid gap-3 rounded-3xl border border-line bg-panel/80 p-4 shadow-soft"
          onSubmit={(event) => {
            event.preventDefault();
            void runScan();
          }}
        >
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              CIDR ranges
            </label>
            <textarea
              className="min-h-24 rounded-2xl border border-line bg-surface/85 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/12"
              placeholder="Enter one or more CIDR ranges, like 192.168.1.0/24 or 10.0.0.0/24"
              value={cidrInput}
              onChange={(event) => setCidrInput(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-line bg-surface px-3 py-1">
              {parsedCidrs.length > 0
                ? `${parsedCidrs.length} range${parsedCidrs.length === 1 ? "" : "s"} ready`
                : "Enter a range to search"}
            </span>
            {state.lastScannedAt ? (
              <span className="rounded-full border border-line bg-surface px-3 py-1">
                Last scan: {state.lastScannedAt}
              </span>
            ) : null}
            {state.summary ? (
              <span className="rounded-full border border-line bg-surface px-3 py-1">
                {state.summary.totalIps} IPs probed
              </span>
            ) : null}
            {!parsedCidrs.length ? (
              <span className="rounded-full border border-line bg-surface px-3 py-1">
                Input required before search
              </span>
            ) : null}
          </div>
        </form>

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="Live hosts" value={String(state.items.length)} />
          <StatCard
            label="Scanned ranges"
            value={String(discoveredNetworks.length || parsedCidrs.length || 0)}
          />
          <StatCard
            label="Skipped ranges"
            value={String(skippedNetworks.length)}
          />
        </div>

        {discoveredNetworks.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-xs text-muted">
            <span className="font-semibold uppercase tracking-[0.18em] text-muted">
              Scanned
            </span>
            {discoveredNetworks.map((cidr) => (
              <span
                key={cidr}
                className="rounded-full border border-line bg-panel px-3 py-1 text-ink"
              >
                {cidr}
              </span>
            ))}
          </div>
        ) : null}

        {skippedNetworks.length > 0 ? (
          <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-ink">
            Some large or unsupported ranges were skipped: {skippedNetworks.join(", ")}.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-line bg-panel/85 shadow-soft">
          <div className="border-b border-line bg-window-chrome/85 px-4 py-3 text-sm font-medium text-ink">
            Discovered hosts
          </div>

          <div className="min-h-0 overflow-auto">
            {loading && state.items.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted">
                Scanning the network...
              </div>
            ) : !hasSearched ? (
              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted">
                Enter one or more CIDR ranges above, then click Search to discover devices.
              </div>
            ) : state.items.length === 0 ? (
              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted">
                No hosts were discovered in the selected range.
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-window-chrome/95 text-left text-xs uppercase tracking-[0.16em] text-muted">
                  <tr>
                    <Th>IP Address</Th>
                    <Th>Hostname</Th>
                    <Th>MAC Address</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((item) => (
                    <tr
                      key={`${item.ip}-${item.mac}`}
                      className="border-t border-line/70 transition hover:bg-surface/65"
                    >
                      <Td className="font-medium text-ink">{item.ip}</Td>
                      <Td>{item.hostname || "Unknown"}</Td>
                      <Td className="font-mono text-xs tracking-[0.02em] text-muted">
                        {item.mac}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 px-4 py-3 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: string }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
