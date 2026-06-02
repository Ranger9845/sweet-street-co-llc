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
}

export function getConsoleLogs(): LogEntry[] {
  return [...buffer];
}
