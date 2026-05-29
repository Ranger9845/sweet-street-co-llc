import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { code } = req.body ?? {};
  if (!code) return err(res, 400, "code is required");

  const { data, error } = await supabase()
    .from("discount_codes")
    .select("*")
    .ilike("code", code.trim())
    .eq("active", true)
    .maybeSingle();

  if (error) return err(res, 500, error.message);
  if (!data) return res.status(404).json({ valid: false, error: "Invalid or inactive discount code" });

  return res.json({
    valid: true,
    code: data.code,
    schoolName: data.school_name,
    discountType: data.discount_type,
    discountAmount: Number(data.discount_amount),
  });
}
