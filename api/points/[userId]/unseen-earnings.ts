import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const { userId } = req.query;
  const sb = supabase();

  const { data: seenRow } = await sb
    .from("user_seen_points")
    .select("seen_at")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const seenAt: string | null = seenRow?.seen_at ?? null;

  const { data: ledger, error } = await sb
    .from("points_ledger")
    .select("points, created_at")
    .eq("clerk_user_id", userId);

  if (error) return err(res, 500, error.message);

  const rows = ledger ?? [];

  if (!seenAt) {
    const balance = rows.reduce((s, r) => s + (r.points ?? 0), 0);
    return res.json({ earned: 0, previousBalance: balance });
  }

  const seenDate = new Date(seenAt);
  let previousBalance = 0;
  let earned = 0;

  for (const row of rows) {
    const pts = row.points ?? 0;
    if (new Date(row.created_at) <= seenDate) {
      previousBalance += pts;
    } else {
      earned += pts;
    }
  }

  return res.json({ earned, previousBalance });
}
