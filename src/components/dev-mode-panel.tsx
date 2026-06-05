import { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Beaker, X, Megaphone, ChevronUp, Loader2, CheckCircle2, Palette,
  Store, Activity, User2, Copy, RefreshCw, Trash2, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { setExtraHeaders } from "@workspace/api-client-react";
import { usePlatform, type Platform } from "@/hooks/use-platform";

const DEV_KEY = "ranger";
const STORAGE_KEY = "ss_dev_mode";
const DEV_USER_ID = "user_3EVPyNPz6vSWHsxoM6z4z6dmlny";

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

type AnnouncementFields = {
  devNotificationEnabled: boolean;
  devNotificationTitle: string;
  devNotificationBody: string;
  devNotificationMaxShows: number;
  devNotificationCtaLabel: string;
  devNotificationCtaUrl: string;
};

const defaults: AnnouncementFields = {
  devNotificationEnabled: false,
  devNotificationTitle: "",
  devNotificationBody: "",
  devNotificationMaxShows: 1,
  devNotificationCtaLabel: "",
  devNotificationCtaUrl: "",
};

const THEME_OPTIONS: { label: string; value: Platform | "auto"; emoji: string; desc: string }[] = [
  { label: "Auto",    value: "auto",    emoji: "🌐", desc: "Detect device" },
  { label: "iOS",     value: "ios",     emoji: "🍎", desc: "Frosted glass" },
  { label: "Android", value: "android", emoji: "🤖", desc: "Material You"  },
];

type DevStatus = {
  shopOpen: boolean;
  shopName: string;
  activeOrders: number;
  serverTime: string;
} | null;

export function DevModePanel() {
  const { user } = useUser();

  const [clickCount, setClickCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(() => isDevMode());
  const [panelOpen, setPanelOpen] = useState(false);

  const { platform, rawPlatform, preference, forcePlatform } = usePlatform();

  // Announcement state
  const [fields, setFields] = useState<AnnouncementFields>(defaults);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Dev status (shop open state, active orders)
  const [devStatus, setDevStatus] = useState<DevStatus>(null);
  const [shopToggling, setShopToggling] = useState(false);
  const [copied, setCopied] = useState<"email" | "id" | null>(null);

  // Auto-activate for the dev account
  useEffect(() => {
    if (!user?.id || user.id !== DEV_USER_ID) return;
    if (isDevMode()) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
    setExtraHeaders({ "x-dev-key": DEV_KEY });
    setActive(true);
  }, [user?.id]);

  // Sync extra headers on mount
  useEffect(() => {
    if (isDevMode()) {
      setExtraHeaders({ "x-dev-key": DEV_KEY });
    }
  }, []);

  // Load dev status when panel opens
  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/dev/status", { headers: { "x-dev-key": DEV_KEY } });
      if (r.ok) setDevStatus(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) return;
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setFields({
          devNotificationEnabled: data.devNotificationEnabled ?? false,
          devNotificationTitle: data.devNotificationTitle ?? "",
          devNotificationBody: data.devNotificationBody ?? "",
          devNotificationMaxShows: data.devNotificationMaxShows ?? 1,
          devNotificationCtaLabel: data.devNotificationCtaLabel ?? "",
          devNotificationCtaUrl: data.devNotificationCtaUrl ?? "",
        });
      })
      .catch(() => {});
  }, [active]);

  useEffect(() => {
    if (panelOpen) loadStatus();
  }, [panelOpen, loadStatus]);

  const handleSecretClick = useCallback(() => {
    setClickCount((c) => {
      const next = c + 1;
      if (next >= 3) {
        setDialogOpen(true);
        return 0;
      }
      return next;
    });
  }, []);

  const handleActivate = () => {
    if (pw === DEV_KEY) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setExtraHeaders({ "x-dev-key": DEV_KEY });
      setActive(true);
      setDialogOpen(false);
      setPw("");
      setError("");
    } else {
      setError("Incorrect key.");
      setPw("");
    }
  };

  const handleDeactivate = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setExtraHeaders({});
    setActive(false);
    setPanelOpen(false);
  };

  const handleShopToggle = async (open: boolean) => {
    setShopToggling(true);
    try {
      const r = await fetch("/api/dev/shop-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dev-key": DEV_KEY },
        body: JSON.stringify({ isOpen: open }),
      });
      if (r.ok) setDevStatus((s) => s ? { ...s, shopOpen: open } : s);
    } catch {}
    setShopToggling(false);
  };

  const handleClearNotifs = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("ss_notif_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  };

  const handleCopy = (type: "email" | "id", value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSaveAnnouncement = async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  };

  const set = <K extends keyof AnnouncementFields>(k: K, v: AnnouncementFields[K]) =>
    setFields((f) => ({ ...f, [k]: v }));

  const activeThemeValue: Platform | "auto" =
    preference === "force-ios"      ? "ios" :
    preference === "force-android"  ? "android" :
    (preference === null || preference === "platform" || preference === "default")
      ? "auto"
      : "auto";

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const userId = user?.id ?? null;

  const fmtServerTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <>
      {/* Copyright trigger */}
      <span
        onClick={handleSecretClick}
        className="cursor-default select-none"
        title=""
      >
        © {new Date().getFullYear()} Sweet Street Co LLC. All rights reserved.
      </span>

      <AnimatePresence>
        {active && (
          <>
            {/* Floating panel */}
            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  key="dev-panel"
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="fixed bottom-16 left-4 z-50 w-80 rounded-2xl shadow-2xl bg-white border border-violet-200 overflow-hidden"
                  style={{ maxHeight: "calc(100dvh - 80px)", overflowY: "auto" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white sticky top-0 z-10">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Beaker className="h-3.5 w-3.5" />
                      Developer Mode
                    </div>
                    <button
                      onClick={() => setPanelOpen(false)}
                      className="opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-5">
                    {/* Session row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Shop forced open for testing</span>
                      <button
                        onClick={handleDeactivate}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                      >
                        Exit dev mode
                      </button>
                    </div>

                    <div className="border-t border-border" />

                    {/* ── Identity ───────────────────────────────────────── */}
                    {(userEmail || userId) && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User2 className="h-3.5 w-3.5 text-violet-500" />
                            <span className="text-sm font-semibold text-foreground">Identity</span>
                          </div>

                          {userEmail && (
                            <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
                              <button
                                onClick={() => handleCopy("email", userEmail)}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy email"
                              >
                                {copied === "email" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}

                          {userId && (
                            <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                              <span className="text-xs font-mono text-muted-foreground truncate">{userId}</span>
                              <button
                                onClick={() => handleCopy("id", userId)}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy Clerk user ID"
                              >
                                {copied === "id" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-border" />
                      </>
                    )}

                    {/* ── Shop Control ───────────────────────────────────── */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-sm font-semibold text-foreground">Shop Control</span>
                        </div>
                        <button
                          onClick={loadStatus}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Refresh status"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </div>

                      {devStatus ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {devStatus.shopOpen ? "🟢 Shop is open" : "🔴 Shop is closed"}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {devStatus.activeOrders} active order{devStatus.activeOrders !== 1 ? "s" : ""} · {fmtServerTime(devStatus.serverTime)}
                              </p>
                            </div>
                            <Switch
                              checked={devStatus.shopOpen}
                              onCheckedChange={handleShopToggle}
                              disabled={shopToggling}
                              className="scale-90"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Toggling this writes directly to the database — customers will see the change immediately.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading…
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border" />

                    {/* ── Theme Simulator ──────────────────────────────── */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Palette className="h-3.5 w-3.5 text-violet-500" />
                        <span className="text-sm font-semibold text-foreground">Theme Simulator</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {THEME_OPTIONS.map(({ label, value, emoji, desc }) => {
                          const isActive = activeThemeValue === value;
                          return (
                            <button
                              key={value}
                              onClick={() => forcePlatform(value)}
                              className={[
                                "relative flex flex-col items-center gap-0.5 rounded-xl border py-2.5 px-1 text-center transition-all duration-150",
                                isActive
                                  ? "border-violet-500 bg-violet-50 shadow-sm"
                                  : "border-border bg-muted/40 hover:border-violet-300 hover:bg-violet-50/60",
                              ].join(" ")}
                            >
                              <span className="text-base leading-none">{emoji}</span>
                              <span className={`text-[11px] font-semibold leading-tight mt-0.5 ${isActive ? "text-violet-700" : "text-foreground"}`}>
                                {label}
                              </span>
                              <span className="text-[9px] text-muted-foreground leading-tight">{desc}</span>
                              {isActive && (
                                <motion.span
                                  layoutId="theme-active-dot"
                                  className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-violet-500"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Detected: <span className="font-medium">{rawPlatform}</span> · Active: <span className="font-medium">{platform}</span>
                      </p>
                    </div>

                    <div className="border-t border-border" />

                    {/* ── Quick Actions ─────────────────────────────────── */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-violet-500" />
                        <span className="text-sm font-semibold text-foreground">Quick Actions</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleClearNotifs}
                          className="flex items-center gap-1.5 justify-center text-xs font-medium border border-border rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors text-foreground/70"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear notifs
                        </button>
                        <button
                          onClick={() => window.location.reload()}
                          className="flex items-center gap-1.5 justify-center text-xs font-medium border border-border rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors text-foreground/70"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reload page
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        "Clear notifs" resets how many times each announcement has shown for this browser.
                      </p>
                    </div>

                    <div className="border-t border-border" />

                    {/* ── Dev Announcement ─────────────────────────────── */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3.5 w-3.5 text-violet-500" />
                        <span className="text-sm font-semibold text-foreground">Dev Announcement</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id="dev-ann-enabled"
                          checked={fields.devNotificationEnabled}
                          onCheckedChange={(v) => set("devNotificationEnabled", v)}
                          className="scale-90"
                        />
                        <Label htmlFor="dev-ann-enabled" className="text-xs cursor-pointer">
                          {fields.devNotificationEnabled ? "Live — customers will see it" : "Hidden"}
                        </Label>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Title</Label>
                        <Input
                          value={fields.devNotificationTitle}
                          onChange={(e) => set("devNotificationTitle", e.target.value)}
                          placeholder="e.g. New feature alert!"
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Message</Label>
                        <Textarea
                          value={fields.devNotificationBody}
                          onChange={(e) => set("devNotificationBody", e.target.value)}
                          placeholder="What do you want to tell customers?"
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Button label</Label>
                          <Input
                            value={fields.devNotificationCtaLabel}
                            onChange={(e) => set("devNotificationCtaLabel", e.target.value)}
                            placeholder="Learn More"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Button URL</Label>
                          <Input
                            value={fields.devNotificationCtaUrl}
                            onChange={(e) => set("devNotificationCtaUrl", e.target.value)}
                            placeholder="https://..."
                            className="h-8 text-sm"
                            disabled={!fields.devNotificationCtaLabel}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Shows per user</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={fields.devNotificationMaxShows}
                          onChange={(e) => set("devNotificationMaxShows", Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 w-16 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">time{fields.devNotificationMaxShows !== 1 ? "s" : ""}</span>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleSaveAnnouncement}
                        disabled={saveStatus === "saving"}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs"
                      >
                        {saveStatus === "saving" ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Saving...</>
                        ) : saveStatus === "saved" ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1.5" /> Saved!</>
                        ) : (
                          "Save Announcement"
                        )}
                      </Button>

                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Changing the title, message, or button auto-resets the show count for all users.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bubble badge */}
            <motion.div
              key="dev-badge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-4 left-4 z-50"
            >
              <button
                onClick={() => setPanelOpen((o) => !o)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 transition-colors text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"
              >
                <Beaker className="h-3 w-3" />
                DEV MODE
                <ChevronUp
                  className={`h-3 w-3 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""}`}
                />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Activation dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); setPw(""); setError(""); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-violet-500" />
              Developer Mode
            </DialogTitle>
            <DialogDescription>
              Forces the shop open for testing. Enter the developer key to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleActivate(); }} className="space-y-3">
            <Input
              type="password"
              autoFocus
              placeholder="Developer key"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(""); }}
              className="font-mono"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                Activate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
