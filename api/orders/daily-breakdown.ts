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

function getCtHour(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false });
  return parseInt(dtf.formatToParts(new Date(utcMs)).find(p => p.type === "hour")!.value, 10) % 24;
}

const HOUR_LABEL = (h: number) => h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
const COST_MARGIN = 0.35; // assume ~35% COGS, 65% gross margin

function buildInsight(params: {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  topItem: { name: string; count: number } | null;
  hourlyPeakLabel: string | null;
  vsYesterday: { revenueDeltaPct: number } | null;
}): string {
  const { totalRevenue, orderCount, avgOrderValue, topItem, hourlyPeakLabel, vsYesterday } = params;

  if (orderCount === 0) {
    return "No orders yet today — but the day is young! Get prepped and ready for the rush. 🍬";
  }

  const lines: string[] = [];

  if (vsYesterday) {
    const pct = vsYesterday.revenueDeltaPct;
    if (pct >= 15) lines.push(`You're up ${pct.toFixed(0)}% vs yesterday — incredible day! 🎉`);
    else if (pct >= 5) lines.push(`Up ${pct.toFixed(0)}% over yesterday. Nice work!`);
    else if (pct <= -15) lines.push(`Down ${Math.abs(pct).toFixed(0)}% vs yesterday. Consider pushing a special. 📣`);
    else if (pct <= -5) lines.push(`Slightly behind yesterday's pace.`);
    else lines.push(`Tracking very close to yesterday's numbers.`);
  }

  if (topItem) {
    lines.push(`${topItem.name} is the top seller with ${topItem.count} sold.`);
  }

  if (hourlyPeakLabel) {
    lines.push(`Busiest hour so far: ${hourlyPeakLabel}.`);
  }

  if (avgOrderValue > 0) {
    lines.push(`Average order is $${avgOrderValue.toFixed(2)}.`);
  }

  if (lines.length === 0) {
    lines.push(`${orderCount} order${orderCount !== 1 ? "s" : ""} and $${totalRevenue.toFixed(2)} so far today.`);
  }

  return lines.join(" ");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const sb = supabase();
  const todayStart = getCtDayUTC(0);
  const yesterdayStart = getCtDayUTC(1);
  const twoDaysAgo = getCtDayUTC(2);

  const [todayRes, yesterdayRes] = await Promise.all([
    sb.from("orders").select("total_amount, items, created_at")
      .gte("created_at", todayStart.toISOString())
      .not("status", "eq", "cancelled"),
    sb.from("orders").select("total_amount")
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString())
      .not("status", "eq", "cancelled"),
  ]);

  if (todayRes.error) return err(res, 500, todayRes.error.message);

  const todayOrders = todayRes.data ?? [];
  const yesterdayOrders = yesterdayRes.data ?? [];

  // Basic stats
  const totalRevenue = todayOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const orderCount = todayOrders.length;
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount * 100) / 100 : 0;
  const netProfit = Math.round(totalRevenue * (1 - COST_MARGIN) * 100) / 100;

  // Item aggregation
  type ItemStat = { name: string; count: number; revenue: number };
  const itemMap = new Map<string, ItemStat>();
  const hourlyRevenue = new Array(24).fill(0);

  for (const o of todayOrders) {
    const items = (o.items ?? []) as Array<{ menuItemName?: string; name?: string; quantity?: number; unitPrice?: number }>;
    for (const item of items) {
      const name = item.menuItemName ?? item.name ?? "Unknown";
      const qty = item.quantity ?? 1;
      const price = item.unitPrice ?? 0;
      const existing = itemMap.get(name) ?? { name, count: 0, revenue: 0 };
      existing.count += qty;
      existing.revenue = Math.round((existing.revenue + qty * price) * 100) / 100;
      itemMap.set(name, existing);
    }
    const h = getCtHour(new Date(o.created_at as string).getTime());
    if (h >= 0 && h < 24) hourlyRevenue[h] += Number(o.total_amount) || 0;
  }

  const itemList: ItemStat[] = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);
  const topItems = itemList.slice(0, 5);
  const bottomItems = itemList.length > 5 ? itemList.slice(-Math.min(3, itemList.length - 5)) : [];

  // Hourly peak
  let peakHour = -1;
  let peakRevenue = 0;
  for (let h = 0; h < 24; h++) {
    if (hourlyRevenue[h] > peakRevenue) { peakRevenue = hourlyRevenue[h]; peakHour = h; }
  }
  const hourlyPeak = peakHour >= 0 && peakRevenue > 0
    ? { hour: peakHour, label: HOUR_LABEL(peakHour), revenue: Math.round(peakRevenue * 100) / 100 }
    : null;

  // vs Yesterday
  const yRevenue = yesterdayOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const revenueDelta = Math.round((totalRevenue - yRevenue) * 100) / 100;
  const revenueDeltaPct = yRevenue > 0 ? Math.round((revenueDelta / yRevenue) * 1000) / 10 : 0;
  const vsYesterday = yesterdayOrders.length > 0
    ? { revenue: Math.round(yRevenue * 100) / 100, orderCount: yesterdayOrders.length, revenueDelta, revenueDeltaPct }
    : null;

  const aiInsight = buildInsight({
    totalRevenue, orderCount, avgOrderValue,
    topItem: topItems[0] ?? null,
    hourlyPeakLabel: hourlyPeak?.label ?? null,
    vsYesterday,
  });

  return res.json({
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    netProfit,
    orderCount,
    avgOrderValue,
    topItems,
    bottomItems,
    hourlyPeak,
    aiInsight,
    vsYesterday,
    generatedAt: new Date().toISOString(),
  });
}
