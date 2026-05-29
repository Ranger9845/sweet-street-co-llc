import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  const sb = supabase();

  if (req.method === "PATCH") {
    const body = req.body?.data ?? req.body;
    const { id: _id, ...fields } = body;
    const { data, error } = await sb.from("menu_items").update(fields).eq("id", id).select().single();
    if (error) return err(res, 400, error.message);
    return res.json(data);
  }

  if (req.method === "DELETE") {
    const { error } = await sb.from("menu_items").delete().eq("id", id);
    if (error) return err(res, 400, error.message);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
