import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();
  const clerkUserId = (req.headers["x-clerk-user-id"] as string) || (req.query.userId as string);

  if (req.method === "GET") {
    if (!clerkUserId) return res.json([]);
    const { data, error } = await sb
      .from("favorites")
      .select("menu_item_id")
      .eq("clerk_user_id", clerkUserId);
    if (error) return err(res, 500, error.message);
    return res.json((data ?? []).map((f) => f.menu_item_id));
  }

  if (req.method === "POST") {
    const { menuItemId, remove } = req.body ?? {};
    if (!clerkUserId || !menuItemId) return err(res, 400, "userId and menuItemId required");

    if (remove) {
      await sb.from("favorites").delete().eq("clerk_user_id", clerkUserId).eq("menu_item_id", menuItemId);
      return res.json({ removed: true });
    }

    const { data, error } = await sb
      .from("favorites")
      .upsert({ clerk_user_id: clerkUserId, menu_item_id: menuItemId })
      .select()
      .single();
    if (error) return err(res, 400, error.message);
    return res.json(data);
  }

  return err(res, 405, "Method not allowed");
}
