import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err, getShopTimeInfo, sendOrderConfirmationEmail, sendPushToOwners } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const { status, clerkUserId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    let query = sb.from("orders").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (clerkUserId) query = query.eq("clerk_user_id", clerkUserId);
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error } = await query;
    if (error) return err(res, 500, error.message);
    return res.json((data ?? []).map(orderToClient));
  }

  if (req.method === "POST") {
    // Hard block: reject all new orders while the shop is closed
    const { data: shopSettings } = await sb.from("settings").select("is_open").eq("id", 1).maybeSingle();
    if (shopSettings && shopSettings.is_open === false) {
      return err(res, 503, "Shop is currently closed. No orders are being accepted.");
    }

    // Also block when outside posted business hours, regardless of manual toggle
    const { shopClosedByHours, isSunday } = getShopTimeInfo();
    if (shopClosedByHours) {
      return err(res, 503, isSunday
        ? "Shop is closed on Sundays. Come back Monday!"
        : "Shop is currently closed. Please check our hours.");
    }

    const body = req.body?.data ?? req.body;
    const { items, ...fields } = body;
    const isCardPayment = fields.paymentMethod === "card";

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
        // Card payments start hidden from the dashboard until payment succeeds
        status: isCardPayment ? "payment_pending" : "pending",
        source: fields.source ?? "web",
      })
      .select()
      .single();

    if (orderErr) return err(res, 400, orderErr.message);
    // Don't send confirmation email/push for card orders yet — send after payment clears
    if (!isCardPayment) {
      sendOrderConfirmationEmail(order as Record<string, unknown>);
      sendPushToOwners({
        title: "New order!",
        body: `${fields.customerName ?? "Customer"} — $${Number(fields.totalAmount ?? 0).toFixed(2)}`,
        url: "/owner",
        tag: "sweetstreet-new-order",
      });
      // Deduct loyalty points immediately for pay-in-store orders
      if (fields.rewardId && fields.clerkUserId) {
        sb.from("rewards")
          .select("points_cost, name")
          .eq("id", fields.rewardId)
          .maybeSingle()
          .then(({ data: reward }) => {
            if (!reward?.points_cost) return;
            sb.from("points_ledger").insert({
              clerk_user_id: fields.clerkUserId,
              points: -Number(reward.points_cost),
              type: "redeem",
              description: `Redeemed: ${reward.name ?? "Reward"} (Order #${(order as Record<string, unknown>).id})`,
            }).then(() => {}).catch((e: Error) => console.error("[orders] points deduction:", e.message));
          })
          .catch((e: Error) => console.error("[orders] reward lookup:", e.message));
      }
    }
    return res.status(201).json(orderToClient(order as Record<string, unknown>));
  }

  return err(res, 405, "Method not allowed");
}
