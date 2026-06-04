import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, orderToClient, err } from "../../_utils";
import {
  getSquareBaseUrl,
  normalizePhone,
  searchLoyaltyAccount,
  createLoyaltyAccount,
  accumulateLoyaltyPoints,
} from "../../loyalty/_square-loyalty";

async function awardLoyaltyPoints(phone: string, orderId: string): Promise<void> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  try {
    const baseUrl = getSquareBaseUrl();
    let account = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!account) account = await createLoyaltyAccount(baseUrl, token, normalized);
    if (account) await accumulateLoyaltyPoints(baseUrl, token, account.id, String(orderId));
  } catch (e) {
    console.error("[status] Square loyalty error:", e instanceof Error ? e.message : e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { id } = req.query;
  const body = req.body?.data ?? req.body;
  const newStatus: string = body.status;

  const sb = supabase();

  // Fetch current order so we know if points were already awarded
  const { data: existing } = await sb.from("orders").select("paid_at,clerk_user_id,customer_phone,total_amount").eq("id", id).maybeSingle();

  // When completing an unpaid order (pays-in-store), stamp paid_at and award points
  const completingUnpaid = newStatus === "completed" && existing && !existing.paid_at;
  const paidAt = completingUnpaid ? new Date().toISOString() : undefined;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...(paidAt ? { paid_at: paidAt } : {}),
  };

  const { data, error } = await sb
    .from("orders")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return err(res, 400, error.message);

  if (completingUnpaid) {
    const order = existing as Record<string, unknown>;

    // Award Supabase points (Clerk-based)
    if (order.clerk_user_id) {
      const earned = Math.floor(Number(order.total_amount ?? 0));
      if (earned > 0) {
        sb.from("points_ledger").insert({
          clerk_user_id: order.clerk_user_id,
          points: earned,
          type: "order",
          description: `Order #${id}`,
        }).then(() => {}).catch(() => {});
      }
    }

    // Award Square loyalty points by phone (fire-and-forget)
    if (order.customer_phone) {
      awardLoyaltyPoints(String(order.customer_phone), String(id));
    }
  }

  return res.json(orderToClient(data as Record<string, unknown>));
}
