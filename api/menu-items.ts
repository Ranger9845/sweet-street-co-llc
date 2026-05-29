import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "./_utils";

// Map DB snake_case → camelCase shape the frontend expects
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

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("menu_items")
      .select("*")
      .order("id");
    if (error) return err(res, 500, error.message);
    return res.json((data ?? []).map(toClient));
  }

  if (req.method === "POST") {
    const body = req.body?.data ?? req.body;
    const { data, error } = await sb.from("menu_items").insert(body).select().single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json(data);
  }

  return err(res, 405, "Method not allowed");
}
