import { useEffect } from "react";
import { setExtraHeaders } from "@workspace/api-client-react";

const DEV_KEY = "ranger";
const STORAGE_KEY = "ss_dev_mode";

export function getDevKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1" ? DEV_KEY : null;
  } catch {
    return null;
  }
}

export function isDevMode(): boolean {
  return getDevKey() !== null;
}

export function getDevHeaders(): Record<string, string> {
  const key = getDevKey();
  return key ? { "x-dev-key": key } : {};
}

/**
 * Silently activates dev mode (forces the shop "open" for testing and attaches
 * the x-dev-key header to API requests) whenever `active` is true — no password
 * prompt needed since the gate is the developer's Clerk account. Replaces the
 * old floating "DEV MODE" button, which is now folded into the Dev Console.
 */
export function useAutoDevMode(active: boolean) {
  useEffect(() => {
    if (active) {
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
      setExtraHeaders({ "x-dev-key": DEV_KEY });
    } else {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      setExtraHeaders({});
    }
    return () => {
      if (active) {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        setExtraHeaders({});
      }
    };
  }, [active]);
}
