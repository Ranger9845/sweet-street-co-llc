import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { userId } = req.query;
  const sb = supabase();

  const { error } = await sb
    .from("user_seen_points")
    .upsert({ clerk_user_id: userId, seen_at: new Date().toISOString() }, { onConflict: "clerk_user_id" });

  if (error) return err(res, 500, error.message);
  return res.json({ ok: true });
}
