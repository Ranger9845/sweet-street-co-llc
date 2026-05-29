import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const sb = supabase();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: stale } = await sb
    .from("orders")
    .select("id, status")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  const bumped: number[] = [];
  for (const order of stale ?? []) {
    await sb
      .from("orders")
      .update({ status: "preparing", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    bumped.push(order.id);
  }

  return res.json({ bumped, count: bumped.length });
}
