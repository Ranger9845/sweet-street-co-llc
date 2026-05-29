import { useState, useEffect } from "react";

export type AnimCfg = {
  ios: {
    scaleFrom: number;
    yTravel: number;
    opacityMid: number;
    tapScale: number;
  };
  android: {
    scaleFrom: number;
    yTravel: number;
    rotateX: number;
    stiffness: number;
    damping: number;
  };
};

export const ANIM_DEFAULTS: AnimCfg = {
  ios: { scaleFrom: 0.94, yTravel: 18, opacityMid: 0.55, tapScale: 0.97 },
  android: { scaleFrom: 0.80, yTravel: 90, rotateX: 18, stiffness: 58, damping: 16 },
};

const ANIM_KEY = "ss-anim-config";

function readConfig(): AnimCfg {
  try {
    const v = localStorage.getItem(ANIM_KEY);
    if (v) {
      const p = JSON.parse(v) as Partial<AnimCfg>;
      return {
        ios: { ...ANIM_DEFAULTS.ios, ...p.ios },
        android: { ...ANIM_DEFAULTS.android, ...p.android },
      };
    }
  } catch {}
  return ANIM_DEFAULTS;
}

export function useAnimationConfig(): AnimCfg {
  const [cfg, setCfg] = useState<AnimCfg>(readConfig);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === ANIM_KEY) setCfg(readConfig());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return cfg;
}
