import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

const DEV_KEY = "ranger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const devKey = req.headers["x-dev-key"] as string | undefined;
  if (devKey !== DEV_KEY) return err(res, 403, "Forbidden");

  const sb = supabase();
  const [settingsResult, activeOrdersResult] = await Promise.all([
    sb.from("settings").select("is_open, shop_name").eq("id", 1).maybeSingle(),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
  ]);

  return res.json({
    shopOpen: settingsResult.data?.is_open ?? false,
    shopName: settingsResult.data?.shop_name ?? "Sweet Street Co",
    activeOrders: activeOrdersResult.count ?? 0,
    serverTime: new Date().toISOString(),
  });
}
