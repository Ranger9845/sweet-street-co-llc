import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err, sendOrderConfirmationEmail } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { gan, orderId } = req.body ?? {};
  if (!gan) return err(res, 400, "Gift card number is required");
  if (!orderId) return err(res, 400, "orderId is required");

  const cleanGan = String(gan).replace(/\s/g, "");
  const sb = supabase();

  // Look up gift card record
  const { data: gcRow } = await sb
    .from("gift_cards")
    .select("square_gift_card_id, amount_cents")
    .eq("gan", cleanGan)
    .maybeSingle();

  if (!gcRow) return err(res, 404, "Gift card not found");

  // Look up order
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("total_amount, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) return err(res, 404, "Order not found");
  if (order.status !== "payment_pending" && order.status !== "pending") {
    return err(res, 400, "Order is already paid");
  }

  const orderCents = Math.round(Number(order.total_amount) * 100);
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token || !locationId) return err(res, 500, "Square not configured");

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    // Check live balance from Square
    const gcRes = await fetch(`${baseUrl}/v2/gift-cards/${gcRow.square_gift_card_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const gcData = (await gcRes.json()) as {
      gift_card?: { balance_money?: { amount: number }; state?: string };
      errors?: { detail: string }[];
    };

    if (!gcRes.ok || gcData.errors) {
      return err(res, 500, "Failed to verify gift card balance");
    }

    const balanceCents = gcData.gift_card?.balance_money?.amount ?? 0;
    if (balanceCents < orderCents) {
      return err(res, 400, `Gift card balance ($${(balanceCents / 100).toFixed(2)}) is less than order total ($${(orderCents / 100).toFixed(2)})`);
    }

    // Redeem exactly the order total from the gift card
    const redeemRes = await fetch(`${baseUrl}/v2/gift-card-activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `gc-redeem-${gcRow.square_gift_card_id}-${orderId}-${Date.now()}`,
        gift_card_activity: {
          type: "REDEEM",
          location_id: locationId,
          gift_card_id: gcRow.square_gift_card_id,
          redeem_activity_details: {
            amount_money: { amount: orderCents, currency: "USD" },
          },
        },
      }),
    });
    const redeemData = (await redeemRes.json()) as { errors?: { detail: string }[] };
    if (!redeemRes.ok || redeemData.errors) {
      return err(res, 400, redeemData.errors?.[0]?.detail ?? "Failed to redeem gift card");
    }

    // Mark order paid
    const { data: updatedOrder, error: updateErr } = await sb
      .from("orders")
      .update({ paid_at: new Date().toISOString(), status: "pending" })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) return err(res, 500, updateErr.message);

    const paidOrder = updatedOrder as Record<string, unknown>;
    sendOrderConfirmationEmail(paidOrder).catch(() => {});

    return res.json({ success: true, order: orderToClient(paidOrder) });
  } catch (e) {
    console.error("[gift-cards/redeem]", e);
    return err(res, 500, "Failed to redeem gift card");
  }
}
