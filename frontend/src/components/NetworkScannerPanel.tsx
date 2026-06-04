import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { scanNetwork, type NetworkScanItem, type NetworkScanSummary } from "../lib/api";

type ScanState = {
  items: NetworkScanItem[];
  summary: NetworkScanSummary | null;
};

const initialScanState: ScanState = {
  items: [],
  summary: null,
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

  const canSearch = parsedCidrs.length > 0 && !loading;

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas text-ink">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form
          className="flex items-stretch gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runScan();
          }}
        >
          <div className="flex-1">
            <textarea
              className="min-h-16 w-full rounded-2xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/10"
              placeholder="Enter one or more CIDR ranges, like 192.168.1.0/24 or 10.0.0.0/24"
              value={cidrInput}
              onChange={(event) => setCidrInput(event.target.value)}
            />
          </div>
          <button
            className="inline-flex h-16 items-center gap-2 rounded-2xl border border-line bg-panel px-4 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSearch}
            onClick={() => void runScan()}
            type="submit"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-panel/75">
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink">Discovered hosts</div>
              <div className="text-xs text-muted">Sorted by IP address.</div>
            </div>
            <div className="text-xs text-muted">
              {state.items.length > 0 ? `${state.items.length} found` : "No entries yet"}
            </div>
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
                <thead className="sticky top-0 z-10 bg-panel/95 text-left text-[10px] uppercase tracking-[0.2em] text-muted">
                  <tr>
                    <Th>IP Address</Th>
                    <Th>Hostname</Th>
                    <Th>MAC Address</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((item) => (
                    <tr
                      key={item.ip}
                      className="border-t border-line/60 transition hover:bg-surface/65"
                    >
                      <Td className="font-mono text-sm font-medium text-ink">{item.ip}</Td>
                      <Td>{item.hostname || "Unknown"}</Td>
                      <Td className="font-mono text-xs tracking-[0.02em] text-muted">
                        {item.mac || "Unavailable"}
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

function Th({ children }: { children: string }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return <td className={`border-t border-line/60 px-4 py-3 align-middle ${className}`}>{children}</td>;
}
