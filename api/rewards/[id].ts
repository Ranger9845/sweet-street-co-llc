import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const id = req.query.id;
  const sb = supabase();

  if (req.method === "PATCH") {
    const body = req.body ?? {};
    const fields: Record<string, unknown> = {};
    if ("name" in body) fields.name = body.name;
    if ("description" in body) fields.description = body.description ?? null;
    if ("pointsCost" in body) fields.points_cost = body.pointsCost;
    if ("discountType" in body) fields.discount_type = body.discountType;
    if ("discountValue" in body) fields.discount_value = body.discountValue;
    if ("active" in body) fields.active = body.active;

    const { data, error } = await sb
      .from("rewards")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) return err(res, 400, error.message);
    return res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      pointsCost: data.points_cost,
      discountType: data.discount_type,
      discountValue: data.discount_value,
      active: data.active,
    });
  }

  if (req.method === "DELETE") {
    const { error } = await sb.from("rewards").delete().eq("id", id);
    if (error) return err(res, 400, error.message);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
