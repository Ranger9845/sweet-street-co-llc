import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const { data, error } = await supabase().from("modifiers").select("*").order("id");
  if (error) return err(res, 500, error.message);
  return res.json(data ?? []);
}
