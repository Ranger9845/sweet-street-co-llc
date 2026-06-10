import { useCallback, useEffect, useState } from "react";

export type PushStatus = "unsupported" | "default" | "denied" | "subscribed" | "not-subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Subscribes this browser/device to Web Push notifications for new orders.
 * Delivers OS-level alerts even when the Sweet Street tab/app is closed,
 * via the service worker registered at /sw.js.
 */
export function usePushNotifications(ownerPassword: string | null) {
  const supported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && typeof Notification !== "undefined";

  const [status, setStatus] = useState<PushStatus>(supported ? "default" : "unsupported");
  const [loading, setLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!supported) { setStatus("unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "not-subscribed");
    } catch {
      setStatus("not-subscribed");
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    refreshStatus();
  }, [supported, refreshStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !ownerPassword) return false;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "not-subscribed");
        return false;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      const { publicKey } = await keyRes.json();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-owner-password": ownerPassword },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) return false;

      setStatus("subscribed");
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, ownerPassword]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-owner-password": ownerPassword ?? "" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("not-subscribed");
    } finally {
      setLoading(false);
    }
  }, [supported, ownerPassword]);

  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!ownerPassword) return false;
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "x-owner-password": ownerPassword },
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [ownerPassword]);

  return { status, loading, supported, subscribe, unsubscribe, sendTest };
}
