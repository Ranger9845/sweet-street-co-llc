import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { id } = req.query;
  const sb = supabase();

  if (req.method === "PATCH") {
    const body = req.body ?? {};
    const fields: Record<string, unknown> = {};
    if (body.active !== undefined) fields.active = body.active;
    if (body.code !== undefined) fields.code = String(body.code).toUpperCase();
    if (body.schoolName !== undefined) fields.school_name = body.schoolName;
    if (body.school_name !== undefined) fields.school_name = body.school_name;
    if (body.discountType !== undefined) fields.discount_type = body.discountType;
    if (body.discountAmount !== undefined) fields.discount_amount = body.discountAmount;
    const { data, error } = await sb.from("discount_codes").update(fields).eq("id", id).select().single();
    if (error) return err(res, 400, error.message);
    const d = data as Record<string, unknown>;
    return res.json({
      id: d.id,
      code: d.code,
      schoolName: d.school_name,
      discountType: d.discount_type,
      discountAmount: d.discount_amount,
      active: d.active,
      createdAt: d.created_at,
    });
  }

  if (req.method === "DELETE") {
    const { error } = await sb.from("discount_codes").delete().eq("id", id);
    if (error) return err(res, 400, error.message);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
