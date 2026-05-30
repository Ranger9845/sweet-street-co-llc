import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const { userId } = req.query;
  const sb = supabase();

  const { data, error } = await sb
    .from("points_ledger")
    .select("id, points, type, description, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return err(res, 500, error.message);

  const rows = data ?? [];
  const balance = rows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  const history = rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    points: r.points,
    type: r.type,
    description: r.description,
    createdAt: r.created_at,
  }));
  return res.json({ balance, userId, history });
}
