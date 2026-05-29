import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, orderToClient, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { id } = req.query;
  const body = req.body?.data ?? req.body;

  const { data, error } = await supabase()
    .from("orders")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return err(res, 400, error.message);
  return res.json(orderToClient(data as Record<string, unknown>));
}
