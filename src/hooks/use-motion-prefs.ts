import { useEffect, useState } from "react";

function detectLowPower(): boolean {
  if (typeof window === "undefined") return false;
  const isSmall = window.matchMedia?.("(max-width: 768px)").matches ?? false;
  const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const lowCpu =
    typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;
  return isSmall || isCoarse || lowMem || lowCpu;
}

function detectReduced(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * Single source of truth for animation gating.
 *  - `reduced`   honors `prefers-reduced-motion`
 *  - `lowPower`  true on small / coarse-pointer / low-memory devices
 *  - `simplify`  convenience: either of the above => simplify visuals
 */
export function useMotionPrefs() {
  const [reduced, setReduced] = useState(detectReduced);
  const [lowPower, setLowPower] = useState(detectLowPower);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sm = window.matchMedia("(max-width: 768px)");
    const onR = () => setReduced(detectReduced());
    const onS = () => setLowPower(detectLowPower());
    rm.addEventListener?.("change", onR);
    sm.addEventListener?.("change", onS);
    return () => {
      rm.removeEventListener?.("change", onR);
      sm.removeEventListener?.("change", onS);
    };
  }, []);

  return { reduced, lowPower, simplify: reduced || lowPower };
}
