import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

function getCtDayUTC(daysAgo = 0): Date {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  const h = get("hour") % 24;
  const ctCurrentMs = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  const ctOffsetMs = d.getTime() - ctCurrentMs;
  const ctMidnightMs = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);
  return new Date(ctMidnightMs + ctOffsetMs);
}

function getCtParts(): { hour: number; dow: number } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short", hour: "numeric", hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")!.value, 10) % 24;
  const weekday = parts.find(p => p.type === "weekday")!.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, dow: dowMap[weekday] ?? 0 };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type RushWindowDef = {
  label: string;
  startHour: number;
  endHour: number;
  peakHour: number;
  type: "school-lunch" | "after-school" | "happy-hour" | "general";
  days: number[]; // 0=Sun, 6=Sat
  reasoning: string;
};

const RUSH_WINDOW_DEFS: RushWindowDef[] = [
  {
    label: "School Lunch",
    startHour: 11, endHour: 13, peakHour: 12,
    type: "school-lunch",
    days: [1, 2, 3, 4, 5],
    reasoning: "School lunch rush — students head out midday for a sweet treat.",
  },
  {
    label: "After School",
    startHour: 14, endHour: 17, peakHour: 15,
    type: "after-school",
    days: [1, 2, 3, 4, 5],
    reasoning: "After-school crowd — peak craving time for students heading home.",
  },
  {
    label: "Happy Hour",
    startHour: 14, endHour: 17, peakHour: 15,
    type: "happy-hour",
    days: [0, 6],
    reasoning: "Weekend afternoon treat time — families and groups out and about.",
  },
  {
    label: "Weekend Morning",
    startHour: 10, endHour: 12, peakHour: 11,
    type: "general",
    days: [0, 6],
    reasoning: "Weekend brunch crowd — casual morning traffic.",
  },
  {
    label: "Weekend Evening",
    startHour: 17, endHour: 20, peakHour: 18,
    type: "general",
    days: [0, 6],
    reasoning: "Weekend evening dessert run — families out for the night.",
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const sb = supabase();
  const { hour: currentHour, dow: dayOfWeek } = getCtParts();
  const dayName = DAY_NAMES[dayOfWeek];

  // Fetch last 4 weeks of same-weekday orders to estimate revenue per window
  const since = getCtDayUTC(28);
  const { data: rows, error } = await sb
    .from("orders")
    .select("created_at, total_amount")
    .gte("created_at", since.toISOString())
    .not("status", "eq", "cancelled");

  if (error) return err(res, 500, error.message);

  const orders = (rows ?? []) as Array<{ created_at: string; total_amount: number | string }>;

  // Build hourly revenue map per day-of-week for historical data
  // dow -> hour -> total revenue
  const historicalByDow: Record<number, Record<number, number[]>> = {};
  for (let d = 0; d <= 6; d++) historicalByDow[d] = {};
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d <= 6; d++) historicalByDow[d][h] = [];
  }

  for (const o of orders) {
    const ts = new Date(o.created_at).getTime();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short", hour: "numeric", hour12: false,
    });
    const parts = dtf.formatToParts(new Date(ts));
    const h = parseInt(parts.find(p => p.type === "hour")!.value, 10) % 24;
    const wd = parts.find(p => p.type === "weekday")!.value;
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const d = dowMap[wd] ?? 0;
    historicalByDow[d][h].push(Number(o.total_amount) || 0);
  }

  // For each window def, compute expected revenue from historical averages
  function windowRevenue(def: RushWindowDef, dow: number): number {
    let total = 0;
    let samples = 0;
    for (let h = def.startHour; h < def.endHour; h++) {
      const hourData = historicalByDow[dow]?.[h] ?? [];
      if (hourData.length > 0) {
        total += hourData.reduce((s, v) => s + v, 0);
        samples += hourData.length;
      }
    }
    // samples is order count; return total revenue
    return Math.round(total * 100) / 100;
  }

  function windowConfidence(def: RushWindowDef, dow: number): "high" | "medium" | "low" {
    let totalSamples = 0;
    for (let h = def.startHour; h < def.endHour; h++) {
      totalSamples += (historicalByDow[dow]?.[h] ?? []).length;
    }
    return totalSamples >= 20 ? "high" : totalSamples >= 8 ? "medium" : "low";
  }

  // Build rush windows for today
  const todayWindows = RUSH_WINDOW_DEFS.filter(w => w.days.includes(dayOfWeek));

  const upcomingRushes = todayWindows
    .filter(w => w.endHour > currentHour) // not completely past
    .map(w => {
      const isActive = currentHour >= w.startHour && currentHour < w.endHour;
      const minutesUntil = isActive
        ? null
        : w.startHour > currentHour
          ? (w.startHour - currentHour) * 60
          : null;
      return {
        label: w.label,
        startHour: w.startHour,
        endHour: w.endHour,
        peakHour: w.peakHour,
        expectedRevenue: windowRevenue(w, dayOfWeek),
        minutesUntil,
        isActive,
        type: w.type,
        confidence: windowConfidence(w, dayOfWeek),
        aiReasoning: w.reasoning,
      };
    })
    .sort((a, b) => a.startHour - b.startHour);

  const nextRush = upcomingRushes.find(w => !w.isActive && w.minutesUntil !== null) ?? null;

  // Quiet period: no window is active and next rush is > 60 minutes away
  const activeWindow = upcomingRushes.find(w => w.isActive);
  const quietPeriod = !activeWindow && (nextRush === null || (nextRush.minutesUntil ?? 0) > 60);
  const quietUntil = quietPeriod && nextRush ? nextRush.startHour : null;

  return res.json({
    currentHour,
    dayOfWeek,
    dayName,
    nextRush,
    upcomingRushes,
    quietPeriod,
    quietUntil,
    generatedAt: new Date().toISOString(),
  });
}
