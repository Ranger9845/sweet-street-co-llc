import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) return err(res, 500, error.message);
    if (!data) return err(res, 404, "Order not found");
    return res.json(orderToClient(data as Record<string, unknown>));
  }

  // DELETE — only allowed for orders that have never been paid (card declined / abandoned)
  if (req.method === "DELETE") {
    const { data: existing } = await sb.from("orders").select("paid_at").eq("id", id).maybeSingle();
    if (!existing) return err(res, 404, "Order not found");
    if (existing.paid_at) return err(res, 403, "Cannot cancel a paid order");
    await sb.from("orders").delete().eq("id", id);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
