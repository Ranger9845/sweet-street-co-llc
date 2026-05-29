import { useState, useEffect } from "react";

export type ColorCfg = {
  primaryHue: number;
  androidHue: number;
  iosCardOpacity: number;
};

export const COLOR_DEFAULTS: ColorCfg = {
  primaryHue: 5,
  androidHue: 22,
  iosCardOpacity: 0.28,
};

export const SS_COLOR_KEY = "ss-color-overrides";

export function readColorCfg(): ColorCfg {
  try {
    const v = localStorage.getItem(SS_COLOR_KEY);
    if (v) return { ...COLOR_DEFAULTS, ...(JSON.parse(v) as Partial<ColorCfg>) };
  } catch {}
  return COLOR_DEFAULTS;
}

function wrap(x: number): number {
  return ((x % 360) + 360) % 360;
}

function applyColorVars(cfg: ColorCfg): void {
  const r = document.documentElement;
  const h = cfg.primaryHue;
  const ah = cfg.androidHue;

  r.style.setProperty("--ss-primary-h",   String(h));
  r.style.setProperty("--ss-android-h",   String(ah));
  r.style.setProperty("--ss-ios-orb1-h",  String(wrap(h - 80)));
  r.style.setProperty("--ss-ios-orb2-h",  String(wrap(h - 30)));
  r.style.setProperty("--ss-ios-orb3-h",  String(wrap(h + 1)));
  r.style.setProperty("--ss-ios-orb4-h",  String(wrap(h - 15)));
  r.style.setProperty("--ss-ios-orb5-h",  String(wrap(h + 13)));
  r.style.setProperty("--ss-ios-base-h",  String(wrap(h - 50)));

  r.style.setProperty("--primary", `${h} 76% 54%`);
  r.style.setProperty("--ring",    `${h} 76% 54%`);
  r.style.setProperty("--sidebar-primary", `${h} 76% 54%`);
  r.style.setProperty("--sidebar-ring",    `${h} 76% 54%`);

  const styleId = "ss-color-overrides-style";
  let el = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }
  el.textContent = `
    .drink-card-gradient {
      background: linear-gradient(
        to bottom right,
        hsl(${wrap(h + 5)} 76% 54%),
        hsl(${h} 72% 58%),
        hsl(${wrap(h - 5)} 65% 62%)
      ) !important;
    }
  `;
}

export function useColorOverrides(): void {
  const [cfg, setCfg] = useState<ColorCfg>(readColorCfg);

  useEffect(() => {
    applyColorVars(cfg);
  }, [cfg]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SS_COLOR_KEY) setCfg(readColorCfg());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
}
