import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

// UTC start of "daysAgo" days ago in Central Time (negative = future)
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

function getCtHour(utcMs: number): number {
  const d = new Date(utcMs);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false });
  return parseInt(dtf.formatToParts(d).find(p => p.type === "hour")!.value, 10) % 24;
}

function getCtIsoDate(utcMs: number): string {
  const parts = new Date(utcMs).toLocaleDateString("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).split("/");
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

function getCtDow(utcMs: number): number {
  return new Date(new Date(utcMs).toLocaleString("en-US", { timeZone: "America/Chicago" })).getDay();
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_LABEL = (h: number) => h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;

// Typical intra-day revenue distribution weights (9a–8p, rest ~0)
const HOUR_WEIGHTS: Record<number, number> = {
  9: 0.04, 10: 0.07, 11: 0.13, 12: 0.17, 13: 0.13, 14: 0.10,
  15: 0.10, 16: 0.12, 17: 0.12, 18: 0.08, 19: 0.04,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const sb = supabase();
  const since = getCtDayUTC(15);

  const { data: rows, error } = await sb
    .from("orders")
    .select("created_at, total_amount")
    .gte("created_at", since.toISOString())
    .not("status", "eq", "cancelled");

  if (error) return err(res, 500, error.message);

  const orders = rows ?? [];
  const todayStart = getCtDayUTC(0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const currentCtHour = getCtHour(Date.now());
  const todayIso = getCtIsoDate(Date.now());

  // Hourly buckets for today (24 slots)
  const hourlyToday = Array.from({ length: 24 }, (_, h) => ({
    hour: h, label: HOUR_LABEL(h), revenue: 0, orders: 0,
  }));

  // Daily buckets for last 14 days
  const dailyMap = new Map<string, { date: string; dayOfWeek: number; label: string; revenue: number; orders: number }>();
  for (let d = 14; d >= 1; d--) {
    const start = getCtDayUTC(d);
    const midday = new Date(start.getTime() + 12 * 3600000);
    const isoDate = getCtIsoDate(midday.getTime());
    const dow = getCtDow(midday.getTime());
    const label = midday.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
    dailyMap.set(isoDate, { date: isoDate, dayOfWeek: dow, label, revenue: 0, orders: 0 });
  }

  // Distribute orders to buckets
  for (const o of orders) {
    const ts = new Date(o.created_at as string).getTime();
    const amt = Number(o.total_amount) || 0;
    const orderIso = getCtIsoDate(ts);

    if (orderIso === todayIso && ts >= todayStart.getTime() && ts < todayEnd.getTime()) {
      const h = getCtHour(ts);
      if (h >= 0 && h < 24) { hourlyToday[h].revenue += amt; hourlyToday[h].orders += 1; }
    } else {
      const bucket = dailyMap.get(orderIso);
      if (bucket) { bucket.revenue += amt; bucket.orders += 1; }
    }
  }

  const last14Days = Array.from(dailyMap.values());

  // Tomorrow projection
  const tomorrowStart = getCtDayUTC(-1);
  const tomorrowDow = getCtDow(tomorrowStart.getTime() + 12 * 3600000);
  const tomorrowDayName = DAY_NAMES[tomorrowDow];
  const sameDayData = last14Days.filter(d => d.dayOfWeek === tomorrowDow);
  const sameDayHistoryDays = sameDayData.length;

  let tomorrowRevenue = 0;
  let weekOverWeekTrend = 0;
  let trendSlopePerDay = 0;
  let confidence: "low" | "medium" | "high" = "low";

  if (sameDayData.length > 0) {
    tomorrowRevenue = Math.round(sameDayData.reduce((s, d) => s + d.revenue, 0) / sameDayData.length * 100) / 100;
    confidence = sameDayData.length >= 4 ? "high" : sameDayData.length >= 2 ? "medium" : "low";
    if (sameDayData.length >= 2) {
      const first = sameDayData[0].revenue;
      const last = sameDayData[sameDayData.length - 1].revenue;
      weekOverWeekTrend = first > 0 ? Math.round((last - first) / first * 1000) / 10 : 0;
      trendSlopePerDay = Math.round((last - first) / (sameDayData.length - 1) * 100) / 100;
    }
  }

  const tomorrowLow = Math.max(0, Math.round(tomorrowRevenue * 0.75 * 100) / 100);
  const tomorrowHigh = Math.round(tomorrowRevenue * 1.25 * 100) / 100;

  // Today paced: if we're past hour 9, extrapolate based on earned-so-far / expected-fraction
  const todayRevenue = hourlyToday.reduce((s, h) => s + h.revenue, 0);
  const earnedFraction = Object.entries(HOUR_WEIGHTS)
    .filter(([h]) => parseInt(h) < currentCtHour)
    .reduce((s, [, w]) => s + w, 0);
  const todayPaced = earnedFraction > 0.05
    ? Math.round(todayRevenue / earnedFraction * 100) / 100
    : todayRevenue;

  const tomorrowHourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: HOUR_LABEL(h),
    projected: Math.round((tomorrowRevenue * (HOUR_WEIGHTS[h] ?? 0)) * 100) / 100,
  }));

  const factors: string[] = [];
  if (sameDayHistoryDays > 0) {
    factors.push(`Based on ${sameDayHistoryDays} previous ${tomorrowDayName}${sameDayHistoryDays !== 1 ? "s" : ""}`);
  } else {
    factors.push("Not enough history for this day of week yet");
  }
  if (weekOverWeekTrend > 5) factors.push(`Revenue trending up ${weekOverWeekTrend.toFixed(1)}% week-over-week`);
  if (weekOverWeekTrend < -5) factors.push(`Revenue trending down ${Math.abs(weekOverWeekTrend).toFixed(1)}% week-over-week`);

  return res.json({
    hourlyToday,
    currentCtHour,
    last14Days,
    projection: {
      tomorrowRevenue,
      tomorrowLow,
      tomorrowHigh,
      tomorrowDayName,
      tomorrowHourly,
      confidence,
      sameDayHistoryDays,
      weekOverWeekTrend,
      trendSlopePerDay,
      todayPaced,
      factors,
    },
  });
}
