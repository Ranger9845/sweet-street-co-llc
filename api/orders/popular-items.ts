import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase()
    .from("orders")
    .select("items")
    .gte("created_at", since)
    .not("status", "eq", "cancelled");

  if (error) return err(res, 500, error.message);

  // Tally quantity ordered per menuItemId
  const counts = new Map<number, number>();
  for (const order of data ?? []) {
    for (const item of (order.items ?? []) as { menuItemId?: number; quantity?: number }[]) {
      if (!item.menuItemId) continue;
      counts.set(item.menuItemId, (counts.get(item.menuItemId) ?? 0) + (Number(item.quantity) || 1));
    }
  }

  // Return top 3 item IDs sorted by count descending
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  return res.json({ popular: topIds });
}
