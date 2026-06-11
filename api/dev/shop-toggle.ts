import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

const DEV_KEY = "ranger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const devKey = req.headers["x-dev-key"] as string | undefined;
  if (devKey !== DEV_KEY) return err(res, 403, "Forbidden");

  const { isOpen } = req.body ?? {};
  if (typeof isOpen !== "boolean") return err(res, 400, "isOpen must be a boolean");

  const sb = supabase();
  const { error } = await sb.from("settings").update({ is_open: isOpen }).eq("id", 1);
  if (error) return err(res, 500, error.message);

  return res.json({ ok: true, isOpen });
}
