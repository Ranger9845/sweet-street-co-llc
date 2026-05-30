import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("rewards").select("*").order("id");
    if (error) return err(res, 500, error.message);
    return res.json(
      (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        pointsCost: r.points_cost,
        discountType: r.discount_type,
        discountValue: r.discount_value,
        active: r.active,
      })),
    );
  }

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  if (req.method === "POST") {
    const body = req.body?.data ?? req.body;
    const { data, error } = await sb
      .from("rewards")
      .insert({
        name: body.name,
        description: body.description ?? null,
        points_cost: body.pointsCost,
        discount_type: body.discountType,
        discount_value: body.discountValue,
        active: body.active ?? true,
      })
      .select()
      .single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json({
      id: data.id,
      name: data.name,
      description: data.description,
      pointsCost: data.points_cost,
      discountType: data.discount_type,
      discountValue: data.discount_value,
      active: data.active,
    });
  }

  return err(res, 405, "Method not allowed");
}
