import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("rewards").select("*").order("id");
    if (error) return err(res, 500, error.message);
    return res.json(data ?? []);
  }

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  if (req.method === "POST") {
    const body = req.body?.data ?? req.body;
    const { data, error } = await sb.from("rewards").insert(body).select().single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const body = req.body?.data ?? req.body;
    const { id, ...fields } = body;
    const { data, error } = await sb.from("rewards").update(fields).eq("id", id).select().single();
    if (error) return err(res, 400, error.message);
    return res.json(data);
  }

  return err(res, 405, "Method not allowed");
}
