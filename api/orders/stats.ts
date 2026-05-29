import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const sb = supabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pending, preparing, ready, todayOrders] = await Promise.all([
    sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "preparing"),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "ready"),
    sb.from("orders").select("total_amount").gte("created_at", todayStart.toISOString()).not("status", "eq", "cancelled"),
  ]);

  const revenueToday = (todayOrders.data ?? []).reduce(
    (sum: number, o: { total_amount?: number }) => sum + (Number(o.total_amount) || 0),
    0,
  );

  return res.json({
    pendingCount: pending.count ?? 0,
    preparingCount: preparing.count ?? 0,
    readyCount: ready.count ?? 0,
    totalToday: todayOrders.data?.length ?? 0,
    revenueToday,
  });
}
