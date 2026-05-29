import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

// Updates pos_category_id and pos_sort_order on menu_items in bulk.
// Body: { assignments: [{ id, pos_category_id, pos_sort_order }] }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const body = req.body?.data ?? req.body;
  const assignments: Array<{ id: number; pos_category_id?: string | null; pos_sort_order?: number }> =
    body.assignments ?? body;

  const sb = supabase();
  const results = await Promise.all(
    assignments.map(({ id, ...fields }) =>
      sb.from("menu_items").update(fields).eq("id", id).select("id, pos_category_id, pos_sort_order").single(),
    ),
  );

  const firstError = results.find((r) => r.error);
  if (firstError?.error) return err(res, 400, firstError.error.message);

  return res.json(results.map((r) => r.data));
}
