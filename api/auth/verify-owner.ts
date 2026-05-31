import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

// POST { password } → { valid: true/false }
// Lets the login page verify the owner password server-side
// without ever exposing the stored password to the client.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { password } = req.body ?? {};
  if (!password) return res.json({ valid: false });

  const sb = supabase();
  const { data } = await sb.from("settings").select("owner_password").eq("id", 1).maybeSingle();
  return res.json({ valid: data?.owner_password === password });
}
