import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sweetstreet:owner-ding-enabled";

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ||
    null
  );
}

type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

function getNotifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission as NotifyPermission;
}

/**
 * Plays the Vintage Sweetener ding (three rising glockenspiel notes) whenever
 * the watched `count` increases.
 *
 * Browsers block audio until the user interacts with the page, so the hook
 * tracks two flags:
 *   - `enabled`:  the owner's persisted preference (across page loads).
 *   - `unlocked`: whether the AudioContext has actually started in this tab
 *                 via a user gesture.
 *
 * The WAV file is loaded once, decoded into an AudioBuffer, and cached for
 * low-latency playback on every subsequent ding.
 *
 * When `notifyPermission === "granted"`, the hook also fires a native
 * browser/OS notification on each increase, delivered even when the tab
 * is in the background.
 */
export function useNewOrderSound(count: number | undefined, opts?: { latestOrder?: { id?: number; customerName?: string } | null }) {
  const supported = typeof window !== "undefined" && getAudioCtor() !== null;

  const [enabled, setEnabledState] = useState<boolean>(false);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [notifyPermission, setNotifyPermission] = useState<NotifyPermission>("default");

  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setEnabledState(true);
      }
    } catch {
      /* localStorage may be blocked */
    }
    setNotifyPermission(getNotifyPermission());
  }, []);

  const sendNotification = useCallback(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    const order = opts?.latestOrder;
    const title = "New Sweet Street order!";
    const body = order?.customerName
      ? `Order #${order.id ?? ""} — ${order.customerName}`.trim()
      : "A fresh order just came in.";
    try {
      const n = new Notification(title, {
        body,
        tag: "sweetstreet-new-order",
        renotify: true,
        requireInteraction: true,
        icon: "/logo.png",
      } as NotificationOptions);
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* some platforms throw if not in a SW context */ }
  }, [opts?.latestOrder]);

  const ensureCtx = useCallback((): AudioContext | null => {
    const Ctor = getAudioCtor();
    if (!Ctor) return null;
    if (!ctxRef.current) {
      const ctx = new Ctor();
      ctxRef.current = ctx;
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "suspended" || ctx.state === "closed") {
          setUnlocked(false);
        } else if (ctx.state === "running") {
          setUnlocked(true);
        }
      });
    }
    return ctxRef.current;
  }, []);

  /** Load and decode /ding.wav once; cache the result in bufferRef. */
  const loadBuffer = useCallback(async (ctx: AudioContext): Promise<AudioBuffer | null> => {
    if (bufferRef.current) return bufferRef.current;
    try {
      const res = await fetch("/ding.wav");
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw);
      bufferRef.current = buf;
      return buf;
    } catch {
      return null;
    }
  }, []);

  const playDing = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* will stay silent */ }
    }
    if (ctx.state !== "running") return;

    const buffer = await loadBuffer(ctx);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }, [loadBuffer]);

  const unlock = useCallback(async (): Promise<boolean> => {
    const ctx = ensureCtx();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      try { await ctx.resume(); } catch { return false; }
    }
    const ok = ctx.state === "running";
    if (ok) {
      setUnlocked(true);
      // Pre-load the buffer while we have the gesture context
      loadBuffer(ctx);
    }
    return ok;
  }, [ensureCtx, loadBuffer]);

  const requestNotifyPermission = useCallback(async (): Promise<NotifyPermission> => {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      const p = Notification.permission as NotifyPermission;
      setNotifyPermission(p);
      return p;
    }
    try {
      const result = (await Notification.requestPermission()) as NotifyPermission;
      setNotifyPermission(result);
      return result;
    } catch { return "default"; }
  }, []);

  const enable = useCallback(async () => {
    const ok = await unlock();
    if (!ok) return false;
    setEnabledState(true);
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    requestNotifyPermission();
    await playDing();
    return true;
  }, [unlock, playDing, requestNotifyPermission]);

  const disable = useCallback(() => {
    setEnabledState(false);
    try { window.localStorage.setItem(STORAGE_KEY, "0"); } catch { /* ignore */ }
  }, []);

  const testDing = useCallback(async () => {
    await unlock();
    await playDing();
  }, [unlock, playDing]);

  // When the tab comes back into view, silently resume so the next ding fires.
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "suspended") return;
      ctx.resume().then(() => {
        if (ctx.state === "running") setUnlocked(true);
      }).catch(() => { });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled]);

  // Watch for count increases; only ding when enabled AND unlocked.
  useEffect(() => {
    if (count === undefined) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevCountRef.current = count;
      return;
    }
    const prev = prevCountRef.current ?? count;
    if (count > prev && enabled) {
      if (unlocked) playDing();
      sendNotification();
    }
    prevCountRef.current = count;
  }, [count, enabled, unlocked, playDing, sendNotification]);

  return {
    enabled,
    unlocked,
    supported,
    enable,
    disable,
    testDing,
    notifyPermission,
    requestNotifyPermission,
    needsUnlock: enabled && !unlocked,
  };
}
