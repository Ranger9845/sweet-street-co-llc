import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await requireOwner(req))) return err(res, 401, "Unauthorized");

  const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const sb = supabase();
  const { data: receives, error } = await sb
    .from("inventory_receives")
    .select("*")
    .gte("received_at", since.toISOString())
    .order("received_at", { ascending: false });

  if (error) return err(res, 500, error.message);

  const rows = receives ?? [];
  const totalSpent = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0);

  // Group by item for a breakdown
  const byItem: Record<string, { itemName: string; totalQty: number; totalCost: number }> = {};
  for (const r of rows) {
    const key = r.variation_id;
    const label = r.item_name
      ? r.variation_name && r.variation_name !== "Regular"
        ? `${r.item_name} — ${r.variation_name}`
        : r.item_name
      : r.variation_id;
    if (!byItem[key]) byItem[key] = { itemName: label, totalQty: 0, totalCost: 0 };
    byItem[key].totalQty += Number(r.quantity);
    byItem[key].totalCost += Number(r.quantity) * Number(r.unit_cost);
  }

  return res.json({
    days,
    totalSpent: Math.round(totalSpent * 100) / 100,
    receiveCount: rows.length,
    receives: rows,
    byItem: Object.values(byItem).sort((a, b) => b.totalCost - a.totalCost),
  });
}
