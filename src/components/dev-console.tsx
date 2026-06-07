import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, X, ChevronUp, Clock, GitBranch, Send, Loader2, CheckCircle2,
  Play, Square, Trash2, ExternalLink, AlertCircle, Wrench, Database,
  Server, Cloud, Bug, AlertTriangle, Monitor, Wifi, WifiOff,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { getConsoleLogs } from "@/lib/console-capture";

const PANEL_BG = "linear-gradient(160deg, #1a0b2e 0%, #2d1248 45%, #3b1454 100%)";
const ACCENT_GRADIENT = "linear-gradient(90deg, #c026d3, #a855f7, #ec4899)";

interface LogEntry {
  level: "log" | "info" | "warn" | "error";
  msg: string;
  ts: string;
}

interface ClockState {
  active: { id: number; clockInAt: string; clockOutAt: string | null; note: string | null } | null;
  sessions: { id: number; clockInAt: string; clockOutAt: string | null; note: string | null }[];
  totals: { todaySeconds: number; weekSeconds: number; allSeconds: number };
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const LOG_COLORS: Record<LogEntry["level"], string> = {
  log: "#d8b4fe",
  info: "#7dd3fc",
  warn: "#fbbf24",
  error: "#fb7185",
};

type Tab = "logs" | "clock" | "report" | "tools";

export function DevConsole() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("logs");

  // ── Live logs ──────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setLogs(getConsoleLogs()), 1000);
    setLogs(getConsoleLogs());
    return () => clearInterval(id);
  }, [open]);

  // ── Clock in/out ───────────────────────────────────────────
  const [clockState, setClockState] = useState<ClockState | null>(null);
  const [clockBusy, setClockBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchClock = useCallback(() => {
    if (!email) return;
    fetch("/api/dev/clock", { headers: { "x-clerk-user-email": email } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setClockState(d))
      .catch(() => {});
  }, [email]);

  useEffect(() => {
    if (!open || !email) return;
    fetchClock();
    const id = setInterval(fetchClock, 15000);
    return () => clearInterval(id);
  }, [open, email, fetchClock]);

  useEffect(() => {
    if (!clockState?.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clockState?.active]);

  const toggleClock = async () => {
    if (!email || clockBusy) return;
    setClockBusy(true);
    try {
      const action = clockState?.active ? "out" : "in";
      const res = await fetch("/api/dev/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-clerk-user-email": email },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchClock();
    } finally {
      setClockBusy(false);
    }
  };

  const liveSeconds = clockState?.active
    ? Math.max(0, Math.round((now - new Date(clockState.active.clockInAt).getTime()) / 1000))
    : 0;

  // ── Report to GitHub ───────────────────────────────────────
  const [summary, setSummary] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [reportError, setReportError] = useState("");

  const sendReport = async () => {
    if (!email || !summary.trim()) return;
    setReportStatus("sending");
    setReportError("");
    try {
      const res = await fetch("/api/dev/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-clerk-user-email": email },
        body: JSON.stringify({
          summary,
          url: window.location.href,
          userAgent: navigator.userAgent,
          logs: getConsoleLogs(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to create issue");
      setIssueUrl(data.issueUrl ?? null);
      setReportStatus("done");
      setSummary("");
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Something went wrong");
      setReportStatus("error");
    }
  };

  if (!email) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="dev-console-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-16 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden border border-fuchsia-500/30"
            style={{ background: PANEL_BG }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ background: ACCENT_GRADIENT }}
            >
              <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
                <Terminal className="h-4 w-4" />
                Dev Console
              </div>
              <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-fuchsia-500/20 bg-black/20">
              {([
                { id: "logs", label: "Logs", icon: Terminal },
                { id: "clock", label: "Clock", icon: Clock },
                { id: "report", label: "Report", icon: GitBranch },
                { id: "tools", label: "Tools", icon: Wrench },
              ] as { id: Tab; label: string; icon: typeof Terminal }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={[
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
                    tab === id
                      ? "text-fuchsia-200 border-b-2 border-fuchsia-400 bg-fuchsia-500/10"
                      : "text-violet-300/60 hover:text-violet-200",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="p-3 max-h-[26rem] overflow-y-auto">
              {tab === "logs" && (
                <LogsTab logs={logs} onClear={() => { setLogs([]); }} />
              )}
              {tab === "clock" && (
                <ClockTab
                  clockState={clockState}
                  liveSeconds={liveSeconds}
                  busy={clockBusy}
                  onToggle={toggleClock}
                />
              )}
              {tab === "report" && (
                <ReportTab
                  summary={summary}
                  setSummary={setSummary}
                  status={reportStatus}
                  error={reportError}
                  issueUrl={issueUrl}
                  logCount={logs.length}
                  onSend={sendReport}
                  onReset={() => { setReportStatus("idle"); setIssueUrl(null); }}
                />
              )}
              {tab === "tools" && <ToolsTab logs={logs} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating badge */}
      <motion.button
        key="dev-console-badge"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg border border-white/10"
        style={{ background: ACCENT_GRADIENT }}
      >
        <Terminal className="h-3.5 w-3.5" />
        DEV
        {clockState?.active && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        )}
        <ChevronUp className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </motion.button>
    </>
  );
}

// ─── Live Logs tab ──────────────────────────────────────────────────────────
function LogsTab({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [logs.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-violet-300/70 font-medium">
          {logs.length} captured {logs.length === 1 ? "entry" : "entries"} · live
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] text-violet-300/60 hover:text-fuchsia-300 transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Clear view
        </button>
      </div>
      <div className="rounded-lg bg-black/40 border border-fuchsia-500/15 p-2 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-violet-300/40 italic">No logs captured yet — interact with the site to see output here.</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="mb-0.5">
              <span className="text-violet-400/50">{l.ts.split("T")[1]?.split(".")[0]}</span>{" "}
              <span style={{ color: LOG_COLORS[l.level] }} className="font-semibold">[{l.level.toUpperCase()}]</span>{" "}
              <span className="text-violet-100/90 break-words">{l.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Clock tab ──────────────────────────────────────────────────────────────
function ClockTab({
  clockState, liveSeconds, busy, onToggle,
}: {
  clockState: ClockState | null;
  liveSeconds: number;
  busy: boolean;
  onToggle: () => void;
}) {
  const active = clockState?.active ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-fuchsia-500/20 bg-black/30 p-4 text-center">
        <p className="text-[11px] uppercase tracking-widest text-violet-300/60 mb-1">
          {active ? "Currently working" : "Not clocked in"}
        </p>
        <p
          className="text-3xl font-bold tabular-nums"
          style={{
            backgroundImage: ACCENT_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {active ? formatDuration(liveSeconds) : "—"}
        </p>
        {active && (
          <p className="text-[10px] text-violet-300/50 mt-1">
            since {new Date(active.clockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        <button
          onClick={onToggle}
          disabled={busy}
          className={[
            "mt-3 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity",
            active ? "bg-rose-600/90 hover:opacity-90" : "hover:opacity-90",
          ].join(" ")}
          style={active ? undefined : { background: ACCENT_GRADIENT }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {active ? "Clock out" : "Clock in"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Today", secs: clockState?.totals.todaySeconds ?? 0 },
          { label: "This week", secs: clockState?.totals.weekSeconds ?? 0 },
          { label: "All time", secs: clockState?.totals.allSeconds ?? 0 },
        ].map(({ label, secs }) => (
          <div key={label} className="rounded-lg bg-black/30 border border-fuchsia-500/15 px-2 py-2 text-center">
            <p className="text-[10px] text-violet-300/60 uppercase tracking-wide">{label}</p>
            <p className="text-sm font-bold text-fuchsia-200">{formatDuration(secs)}</p>
          </div>
        ))}
      </div>

      {clockState && clockState.sessions.length > 0 && (
        <div>
          <p className="text-[11px] text-violet-300/60 mb-1.5 font-medium">Recent sessions</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {clockState.sessions.slice(0, 6).map((s) => {
              const secs = s.clockOutAt
                ? Math.round((new Date(s.clockOutAt).getTime() - new Date(s.clockInAt).getTime()) / 1000)
                : null;
              return (
                <div key={s.id} className="flex items-center justify-between text-[11px] rounded-md bg-black/20 px-2 py-1.5">
                  <span className="text-violet-200/80">
                    {new Date(s.clockInAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-violet-300/50">
                    {new Date(s.clockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {s.clockOutAt ? ` – ${new Date(s.clockOutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : " – now"}
                  </span>
                  <span className="font-semibold text-fuchsia-300">{secs !== null ? formatDuration(secs) : "active"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report-to-GitHub tab ───────────────────────────────────────────────────
function ReportTab({
  summary, setSummary, status, error, issueUrl, logCount, onSend, onReset,
}: {
  summary: string;
  setSummary: (v: string) => void;
  status: "idle" | "sending" | "done" | "error";
  error: string;
  issueUrl: string | null;
  logCount: number;
  onSend: () => void;
  onReset: () => void;
}) {
  if (status === "done") {
    return (
      <div className="text-center py-6 space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold text-violet-100">Issue created on GitHub</p>
        {issueUrl && (
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2"
          >
            View issue <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <div>
          <button onClick={onReset} className="text-[11px] text-violet-300/60 hover:text-violet-200 mt-2">
            Report another issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-violet-300/70 leading-relaxed">
        Describe what's happening — the last {logCount} captured console {logCount === 1 ? "entry" : "entries"},
        page URL, and browser info will be attached automatically and a GitHub issue will be opened in the repo.
      </p>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="e.g. Checkout button does nothing on iOS Safari after applying a discount code…"
        rows={4}
        className="w-full rounded-lg bg-black/40 border border-fuchsia-500/20 px-3 py-2 text-xs text-violet-100 placeholder:text-violet-400/40 outline-none focus:border-fuchsia-400/50 resize-none"
      />
      {status === "error" && (
        <p className="flex items-center gap-1.5 text-[11px] text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}
      <button
        onClick={onSend}
        disabled={status === "sending" || !summary.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ background: ACCENT_GRADIENT }}
      >
        {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send to GitHub
      </button>
    </div>
  );
}

// ─── Tools tab — quick links + env info + log breakdown ────────────────────
const QUICK_LINKS = [
  { label: "GitHub Repo", href: "https://github.com/Ranger9845/sweet-street-co-llc", icon: GitBranch },
  { label: "GitHub Issues", href: "https://github.com/Ranger9845/sweet-street-co-llc/issues", icon: Bug },
  { label: "Render (API)", href: "https://dashboard.render.com/web/srv-d8cuv258nd3s73egsmug", icon: Server },
  { label: "Vercel (Frontend)", href: "https://vercel.com/dashboard", icon: Cloud },
  { label: "Supabase", href: "https://supabase.com/dashboard/project/wmvpmntgnrbnhsevgfks", icon: Database },
];

function ToolsTab({ logs }: { logs: LogEntry[] }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const counts = logs.reduce(
    (acc, l) => { acc[l.level] += 1; return acc; },
    { log: 0, info: 0, warn: 0, error: 0 } as Record<LogEntry["level"], number>
  );

  return (
    <div className="space-y-4">
      {/* Quick links */}
      <div>
        <p className="text-[11px] text-violet-300/60 mb-1.5 font-medium uppercase tracking-wide">Quick links</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-black/30 border border-fuchsia-500/15 px-2.5 py-2 text-[11px] font-medium text-violet-200/90 hover:border-fuchsia-400/40 hover:text-fuchsia-200 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-fuchsia-400/70" />
              <span className="truncate">{label}</span>
              <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
            </a>
          ))}
        </div>
      </div>

      {/* Log breakdown */}
      <div>
        <p className="text-[11px] text-violet-300/60 mb-1.5 font-medium uppercase tracking-wide">Console activity</p>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { level: "log" as const, label: "Log", icon: Terminal },
            { level: "info" as const, label: "Info", icon: Monitor },
            { level: "warn" as const, label: "Warn", icon: AlertTriangle },
            { level: "error" as const, label: "Error", icon: Bug },
          ]).map(({ level, label, icon: Icon }) => (
            <div key={level} className="rounded-lg bg-black/30 border border-fuchsia-500/15 px-2 py-2 text-center">
              <Icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: LOG_COLORS[level] }} />
              <p className="text-sm font-bold" style={{ color: LOG_COLORS[level] }}>{counts[level]}</p>
              <p className="text-[9px] text-violet-300/50 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Environment info */}
      <div>
        <p className="text-[11px] text-violet-300/60 mb-1.5 font-medium uppercase tracking-wide">Environment</p>
        <div className="rounded-lg bg-black/30 border border-fuchsia-500/15 divide-y divide-fuchsia-500/10 text-[11px]">
          <EnvRow icon={online ? Wifi : WifiOff} label="Connection" value={online ? "Online" : "Offline"} accent={online ? "#34d399" : "#fb7185"} />
          <EnvRow icon={Monitor} label="Viewport" value={`${window.innerWidth} × ${window.innerHeight}`} />
          <EnvRow icon={Monitor} label="Screen" value={`${screen.width} × ${screen.height}`} />
          <EnvRow icon={ExternalLink} label="Page" value={window.location.pathname + window.location.search} />
          <EnvRow icon={Terminal} label="Mode" value={import.meta.env.MODE} />
        </div>
      </div>
    </div>
  );
}

function EnvRow({ icon: Icon, label, value, accent }: { icon: typeof Terminal; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <Icon className="h-3 w-3 flex-shrink-0" style={{ color: accent ?? "#a78bfa" }} />
      <span className="text-violet-300/60 font-medium w-20 flex-shrink-0">{label}</span>
      <span className="text-violet-100/90 truncate font-mono">{value}</span>
    </div>
  );
}
