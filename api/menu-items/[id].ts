import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

function toClient(row: Record<string, unknown>) {
  return {
    ...row,
    sizePrices: row.size_prices,
    sizePrepSteps: row.size_prep_steps,
    sizeIngredients: row.size_ingredients,
    modifierIds: row.modifier_ids,
    posCategoryId: row.pos_category_id,
    posSortOrder: row.pos_sort_order,
    posHidden: row.pos_hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  const sb = supabase();

  if (req.method === "PATCH") {
    const body = req.body?.data ?? req.body;
    const { id: _id, ...fields } = body;
    const { data, error } = await sb.from("menu_items").update(fields).eq("id", id).select().single();
    if (error) return err(res, 400, error.message);
    return res.json(toClient(data as Record<string, unknown>));
  }

  if (req.method === "DELETE") {
    const { error } = await sb.from("menu_items").delete().eq("id", id);
    if (error) return err(res, 400, error.message);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
