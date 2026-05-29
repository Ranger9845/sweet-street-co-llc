import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { data: items } = await supabase()
    .from("menu_items")
    .select("id, name, size_prices")
    .eq("available", true)
    .limit(20);

  const pick = items && items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;

  return res.json({
    suggestion: pick
      ? `Try featuring "${pick.name}" as today's special!`
      : "No menu items available to feature.",
    item: pick,
  });
}
