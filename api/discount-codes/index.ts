import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const isOwner = await requireOwner(req);
    if (!isOwner) return err(res, 403, "Forbidden");
    const { data, error } = await sb.from("discount_codes").select("*").order("id");
    if (error) return err(res, 500, error.message);
    return res.json(
      (data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id,
        code: d.code,
        schoolName: d.school_name,
        discountType: d.discount_type,
        discountAmount: d.discount_amount,
        active: d.active,
        createdAt: d.created_at,
      }))
    );
  }

  if (req.method === "POST") {
    const isOwner = await requireOwner(req);
    if (!isOwner) return err(res, 403, "Forbidden");
    const body = req.body ?? {};
    const { data, error } = await sb
      .from("discount_codes")
      .insert({
        code: (body.code ?? "").toUpperCase(),
        school_name: body.schoolName ?? body.school_name ?? null,
        discount_type: body.discountType ?? body.discount_type ?? "percent",
        discount_amount: body.discountAmount ?? body.discount_amount ?? 0,
        active: body.active ?? true,
      })
      .select()
      .single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json({
      id: data.id,
      code: data.code,
      schoolName: data.school_name,
      discountType: data.discount_type,
      discountAmount: data.discount_amount,
      active: data.active,
      createdAt: data.created_at,
    });
  }

  return err(res, 405, "Method not allowed");
}
