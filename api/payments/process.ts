import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  const { orderId, sourceId, ...orderPayload } = body;

  const sb = supabase();

  // If sourceId is "FREE" or no Square keys configured, mark as paid and create order
  const squareAppId = process.env.SQUARE_APPLICATION_ID;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!squareAppId || !squareToken || sourceId === "FREE") {
    // Free / cash order — just mark paid
    if (orderId) {
      const { data, error } = await sb
        .from("orders")
        .update({ paid_at: new Date().toISOString(), status: "pending" })
        .eq("id", orderId)
        .select()
        .single();
      if (error) return err(res, 400, error.message);
      return res.json({ success: true, order: data });
    }
    return res.json({ success: true });
  }

  // Square payment processing
  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl =
      process.env.SQUARE_ENVIRONMENT === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

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
          amount: Math.round((orderPayload.totalAmount ?? 0) * 100),
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

    if (orderId) {
      await sb
        .from("orders")
        .update({ paid_at: new Date().toISOString() })
        .eq("id", orderId);
    }

    return res.json({ success: true, paymentId: squareData.payment?.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Payment processing error";
    return err(res, 500, msg);
  }
}
