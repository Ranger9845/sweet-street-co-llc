const MAX_LOGS = 80;
const SENSITIVE = /password|token|secret|apikey|api_key|authorization|bearer/i;

interface LogEntry {
  level: "log" | "info" | "warn" | "error";
  msg: string;
  ts: string;
}

const buffer: LogEntry[] = [];

function sanitize(args: unknown[]): string {
  try {
    return args
      .map((a) => {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ")
      .replace(/("(?:password|token|secret|key|authorization)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"');
  } catch {
    return "[log serialize error]";
  }
}

function record(level: LogEntry["level"], args: unknown[]) {
  const msg = sanitize(args);
  if (SENSITIVE.test(msg)) return; // skip lines that look like credentials
  buffer.push({ level, msg, ts: new Date().toISOString() });
  if (buffer.length > MAX_LOGS) buffer.shift();
}

export function initConsoleCapture() {
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...a) => { orig.log(...a); record("log", a); };
  console.info = (...a) => { orig.info(...a); record("info", a); };
  console.warn = (...a) => { orig.warn(...a); record("warn", a); };
  console.error = (...a) => { orig.error(...a); record("error", a); };

  // Uncaught exceptions and failed resource loads (scripts, images, etc.)
  window.addEventListener("error", (e) => {
    if (e.target && e.target !== window) {
      const el = e.target as HTMLElement & { src?: string; href?: string };
      record("error", [`Failed to load resource: ${el.tagName?.toLowerCase() ?? "resource"} ${el.src ?? el.href ?? ""}`]);
      return;
    }
    record("error", [`Uncaught ${e.message}`, e.filename ? `(${e.filename}:${e.lineno}:${e.colno})` : ""]);
  }, true);

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    record("error", [`Unhandled rejection: ${reason}`]);
  });

  // Failed fetch requests (network errors and 4xx/5xx responses)
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
    try {
      const res = await origFetch(...args);
      if (!res.ok) record("warn", [`Fetch ${res.status} ${res.statusText}: ${url}`]);
      return res;
    } catch (e) {
      record("error", [`Fetch failed: ${url} — ${e instanceof Error ? e.message : String(e)}`]);
      throw e;
    }
  };
}

export function getConsoleLogs(): LogEntry[] {
  return [...buffer];
}
