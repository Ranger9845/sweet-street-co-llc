import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { data, error } = await supabase()
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return err(res, 500, error.message);
  return res.json(
    (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      comment: r.comment,
      approved: r.approved,
      createdAt: r.created_at,
      menuItemId: r.menu_item_id,
      orderId: r.order_id,
      ownerReply: r.owner_reply,
    }))
  );
}
