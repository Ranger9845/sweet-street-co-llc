/**
 * DevNotificationModal
 *
 * Full-screen overlay the owner can configure from Owner Settings → Developer Broadcast.
 * Tracks per-version view count in localStorage so each unique broadcast
 * only shows up to `maxShows` times per browser.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationSettings = {
  devNotificationEnabled?: boolean;
  devNotificationTitle?: string;
  devNotificationBody?: string;
  devNotificationMaxShows?: number;
  devNotificationVersion?: string;
  devNotificationCtaLabel?: string;
  devNotificationCtaUrl?: string;
};

function getLocalKey(version: string) {
  return `ss_notif_v_${version}`;
}

function getShownCount(version: string): number {
  if (!version) return Infinity;
  try {
    return parseInt(localStorage.getItem(getLocalKey(version)) ?? "0", 10);
  } catch {
    return Infinity;
  }
}

function incrementShownCount(version: string) {
  if (!version) return;
  try {
    const next = getShownCount(version) + 1;
    localStorage.setItem(getLocalKey(version), String(next));
  } catch {
    /* ignore */
  }
}

export function DevNotificationModal() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data: NotificationSettings | null) => {
        if (cancelled || !data) return;
        setSettings(data);

        const {
          devNotificationEnabled,
          devNotificationTitle,
          devNotificationVersion,
          devNotificationMaxShows,
        } = data;

        if (
          !devNotificationEnabled ||
          !devNotificationTitle?.trim() ||
          !devNotificationVersion
        ) return;

        const maxShows = devNotificationMaxShows ?? 1;
        const shown = getShownCount(devNotificationVersion);

        if (shown < maxShows) {
          setVisible(true);
          incrementShownCount(devNotificationVersion);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!settings || !visible) return null;

  const {
    devNotificationTitle: title = "",
    devNotificationBody: body = "",
    devNotificationCtaLabel: ctaLabel = "",
    devNotificationCtaUrl: ctaUrl = "",
  } = settings;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="dev-notif-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            key="dev-notif-card"
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Decorative gradient bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-pink-300 via-primary to-pink-300" />

            <div className="p-8 space-y-5">
              {/* Dismiss button */}
              <button
                onClick={() => setVisible(false)}
                className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full border border-pink-200">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
                Announcement
              </div>

              {/* Title */}
              <h2 className="text-2xl font-serif font-bold text-foreground leading-tight">
                {title}
              </h2>

              {/* Body */}
              {body.trim() && (
                <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
                  {body}
                </p>
              )}

              {/* CTA + dismiss */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {ctaLabel.trim() && ctaUrl.trim() && (
                  <Button
                    asChild
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                      {ctaLabel}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setVisible(false)}
                >
                  Got it
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
