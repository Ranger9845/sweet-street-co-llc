import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    // Public: only approved reviews
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .eq("approved", "approved")
      .order("created_at", { ascending: false });
    if (error) return err(res, 500, error.message);
    return res.json(data ?? []);
  }

  if (req.method === "POST") {
    const body = req.body?.data ?? req.body;
    const { data, error } = await sb
      .from("reviews")
      .insert({ ...body, approved: "pending" })
      .select()
      .single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json(data);
  }

  return err(res, 405, "Method not allowed");
}
