import { useEffect } from "react";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("ss_visitor_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("ss_visitor_sid", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

const INTERVAL_MS = 30_000;

export function useVisitorHeartbeat() {
  useEffect(() => {
    const sessionId = getSessionId();

    const ping = () => {
      fetch("/api/visitors/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        // Use keepalive so the request survives tab close
        keepalive: true,
      }).catch(() => {});
    };

    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
