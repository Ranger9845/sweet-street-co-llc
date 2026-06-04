import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err, sendOrderConfirmationEmail } from "../_utils";
import {
  getSquareBaseUrl,
  normalizePhone,
  searchLoyaltyAccount,
  createLoyaltyAccount,
  adjustLoyaltyPoints,
} from "../loyalty/_square-loyalty";

/**
 * Fire-and-forget: award Square loyalty points for a website order.
 * Uses a manual adjustment because web orders have no Square Order ID.
 */
async function awardLoyaltyPoints(phone: string, points: number): Promise<void> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token || points <= 0) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  try {
    const baseUrl = getSquareBaseUrl();
    let account = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!account) account = await createLoyaltyAccount(baseUrl, token, normalized);
    if (account) {
      await adjustLoyaltyPoints(baseUrl, token, account.id, points, `Website order — ${points} pt${points !== 1 ? "s" : ""} earned`);
    }
  } catch (e) {
    console.error("Square loyalty award error:", e instanceof Error ? e.message : e);
  }
}

/**
 * Fire-and-forget: deduct Square loyalty points when a reward is redeemed.
 * Creates the account first if it doesn't exist yet.
 */
async function deductLoyaltyPoints(phone: string, points: number): Promise<void> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token || points <= 0) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  try {
    const baseUrl = getSquareBaseUrl();
    let account = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!account) account = await createLoyaltyAccount(baseUrl, token, normalized);
    if (account) {
      await adjustLoyaltyPoints(baseUrl, token, account.id, -points, "Reward redeemed");
    }
  } catch (e) {
    console.error("Square loyalty deduct error:", e instanceof Error ? e.message : e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  const { orderId, sourceId, rewardId } = body;

  const sb = supabase();

  // If sourceId is "FREE" or no Square keys configured, mark as paid
  const squareAppId = process.env.SQUARE_APPLICATION_ID;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!squareAppId || !squareToken || sourceId === "FREE") {
    if (orderId) {
      const { data, error } = await sb
        .from("orders")
        .update({ paid_at: new Date().toISOString(), status: "pending" })
        .eq("id", orderId)
        .select()
        .single();
      if (error) return err(res, 400, error.message);
      const orderData = data as Record<string, unknown>;
      const earned = Math.floor(Number(orderData.total_amount ?? 0));
      // Mirror points to Supabase ledger (Clerk-based, kept as fallback)
      if (orderData.clerk_user_id && earned > 0) {
        sb.from("points_ledger").insert({
          clerk_user_id: orderData.clerk_user_id,
          points: earned,
          type: "order",
          description: `Order #${orderId}`,
        }).then(() => {}).catch(() => {});
      }
      // Award Square loyalty points by phone (fire-and-forget)
      if (orderData.customer_phone) {
        awardLoyaltyPoints(String(orderData.customer_phone), earned);
      }
      // Deduct reward points if a reward was redeemed
      if (rewardId) {
        const { data: reward } = await sb.from("rewards").select("points_cost, name").eq("id", rewardId).maybeSingle();
        if (reward?.points_cost) {
          // Deduct from Supabase ledger (Clerk-based balance shown on website)
          if (orderData.clerk_user_id) {
            sb.from("points_ledger").insert({
              clerk_user_id: orderData.clerk_user_id,
              points: -Number(reward.points_cost),
              type: "redeem",
              description: `Redeemed: ${reward.name ?? "Reward"} (Order #${orderId})`,
            }).then(() => {}).catch(() => {});
          }
          // Also deduct from Square loyalty if phone is linked
          if (orderData.customer_phone) {
            deductLoyaltyPoints(String(orderData.customer_phone), Number(reward.points_cost));
          }
        }
      }
      sendOrderConfirmationEmail(orderData);
      return res.json(orderToClient(orderData));
    }
    return res.json({ success: true });
  }

  // Square payment processing — requires orderId to look up the authoritative total
  if (!orderId) {
    return err(res, 400, "orderId is required for card payments");
  }

  try {
    // Look up the order to get the correct charge amount
    const { data: orderRow, error: orderErr } = await sb
      .from("orders")
      .select("total_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderRow) {
      return err(res, 404, "Order not found");
    }

    const totalAmount = Number(orderRow.total_amount ?? 0);
    if (totalAmount <= 0) {
      return err(res, 400, "Order total must be greater than zero for card payments");
    }

    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    const squareRes = await fetch(`${baseUrl}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${squareToken}`,
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: `order-${orderId}-${Date.now()}`,
        amount_money: {
          amount: Math.round(totalAmount * 100),
          currency: "USD",
        },
        location_id: process.env.SQUARE_LOCATION_ID,
      }),
    });

    const squareData = (await squareRes.json()) as { payment?: { id: string }; errors?: { detail: string }[] };

    if (!squareRes.ok || squareData.errors) {
      const msg = squareData.errors?.[0]?.detail ?? "Payment failed";
      return err(res, 400, msg);
    }

    const { data: updatedOrder, error: updateErr } = await sb
      .from("orders")
      .update({ paid_at: new Date().toISOString(), status: "pending" })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) return err(res, 500, updateErr.message);

    const paidOrder = updatedOrder as Record<string, unknown>;
    const earned = Math.floor(Number(paidOrder.total_amount ?? 0));
    // Mirror points to Supabase ledger (Clerk-based, kept as fallback)
    if (paidOrder.clerk_user_id && earned > 0) {
      sb.from("points_ledger").insert({
        clerk_user_id: paidOrder.clerk_user_id,
        points: earned,
        type: "order",
        description: `Order #${orderId}`,
      }).then(() => {}).catch(() => {});
    }
    // Award Square loyalty points by phone (fire-and-forget)
    if (paidOrder.customer_phone) {
      awardLoyaltyPoints(String(paidOrder.customer_phone), earned);
    }
    // Deduct reward points if a reward was redeemed
    if (rewardId) {
      const { data: reward } = await sb.from("rewards").select("points_cost, name").eq("id", rewardId).maybeSingle();
      if (reward?.points_cost) {
        // Deduct from Supabase ledger (Clerk-based balance shown on website)
        if (paidOrder.clerk_user_id) {
          sb.from("points_ledger").insert({
            clerk_user_id: paidOrder.clerk_user_id,
            points: -Number(reward.points_cost),
            type: "redeem",
            description: `Redeemed: ${reward.name ?? "Reward"} (Order #${orderId})`,
          }).then(() => {}).catch(() => {});
        }
        // Also deduct from Square loyalty if phone is linked
        if (paidOrder.customer_phone) {
          deductLoyaltyPoints(String(paidOrder.customer_phone), Number(reward.points_cost));
        }
      }
    }
    sendOrderConfirmationEmail(paidOrder);

    return res.json({ success: true, paymentId: squareData.payment?.id, order: orderToClient(paidOrder) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Payment processing error";
    return err(res, 500, msg);
  }
}
