import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    let query = sb.from("orders").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error } = await query;
    if (error) return err(res, 500, error.message);
    return res.json((data ?? []).map(orderToClient));
  }

  if (req.method === "POST") {
    const body = req.body?.data ?? req.body;
    const { items, ...fields } = body;

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        customer_name: fields.customerName,
        customer_email: fields.customerEmail,
        customer_phone: fields.customerPhone ?? null,
        customer_sms_consent: fields.customerSmsConsent ?? false,
        notes: fields.notes ?? null,
        discount_code: fields.discountCode ?? null,
        discount_amount: fields.discountAmount ?? 0,
        total_amount: fields.totalAmount ?? 0,
        clerk_user_id: fields.clerkUserId ?? null,
        scheduled_for: fields.scheduledFor ?? null,
        items: items ?? [],
        status: "pending",
        source: fields.source ?? "web",
      })
      .select()
      .single();

    if (orderErr) return err(res, 400, orderErr.message);
    return res.status(201).json(orderToClient(order as Record<string, unknown>));
  }

  return err(res, 405, "Method not allowed");
}
