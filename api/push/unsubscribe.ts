import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const body = req.body?.data ?? req.body ?? {};
  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) return err(res, 400, "endpoint is required");

  const sb = supabase();
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return err(res, 400, error.message);

  return res.json({ success: true });
}
