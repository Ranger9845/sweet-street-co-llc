import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, orderToClient, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { id } = req.query;
  const sb = supabase();

  const { data: current } = await sb.from("orders").select("status").eq("id", id).maybeSingle();
  if (!current) return err(res, 404, "Order not found");

  const next =
    current.status === "pending" ? "preparing" :
    current.status === "preparing" ? "ready" :
    current.status;

  const { data, error } = await sb
    .from("orders")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return err(res, 400, error.message);
  return res.json(orderToClient(data as Record<string, unknown>));
}
