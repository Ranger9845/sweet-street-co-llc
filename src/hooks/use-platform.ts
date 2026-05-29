import { useState, useMemo, useCallback } from "react";

export type Platform = "ios" | "android" | "other";
export type ThemePreference =
  | "platform"
  | "default"
  | "force-ios"
  | "force-android"
  | null;

const STORAGE_KEY = "ss-theme-pref";

function detectRawPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Safari/.test(ua) && /Mac/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/Android/.test(ua)) return "android";
  return "other";
}

function readStoredPref(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (
      v === "platform" ||
      v === "default" ||
      v === "force-ios" ||
      v === "force-android"
    )
      return v as ThemePreference;
  } catch {}
  return null;
}

export function usePlatform() {
  const rawPlatform = useMemo(() => detectRawPlatform(), []);

  const [preference, setPreference] = useState<ThemePreference>(readStoredPref);

  const activePlatform: Platform =
    preference === "force-ios"
      ? "ios"
      : preference === "force-android"
        ? "android"
        : preference === "default"
          ? "other"
          : rawPlatform;

  const hasChosen =
    preference !== null &&
    preference !== "force-ios" &&
    preference !== "force-android";

  const choosePlatformTheme = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "platform");
    } catch {}
    setPreference("platform");
  }, []);

  const chooseDefaultTheme = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "default");
    } catch {}
    setPreference("default");
  }, []);

  const resetChoice = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPreference(null);
  }, []);

  const forcePlatform = useCallback((p: Platform | "auto") => {
    if (p === "ios") {
      try {
        localStorage.setItem(STORAGE_KEY, "force-ios");
      } catch {}
      setPreference("force-ios");
    } else if (p === "android") {
      try {
        localStorage.setItem(STORAGE_KEY, "force-android");
      } catch {}
      setPreference("force-android");
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setPreference(null);
    }
  }, []);

  return {
    platform: activePlatform,
    rawPlatform,
    preference,
    hasChosen,
    choosePlatformTheme,
    chooseDefaultTheme,
    resetChoice,
    forcePlatform,
  };
}
