import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err, getShopTimeInfo } from "../_utils";

async function sendOrderConfirmationEmail(order: Record<string, unknown>, items: unknown[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "orders@sweetstreetco.com";
  if (!apiKey || !order.customer_email) return;

  const itemLines = (items ?? [])
    .map((i: unknown) => {
      const item = i as Record<string, unknown>;
      return `<li>${item.quantity ?? 1}× ${item.menuItemName ?? item.menu_item_name ?? "Item"} (${item.size ?? ""})</li>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#c0392b">Sweet Street Co — Order Confirmed!</h2>
      <p>Hi ${order.customer_name ?? "there"},</p>
      <p>We've received your order <strong>#${order.id}</strong>. We'll get it ready as soon as possible!</p>
      ${itemLines ? `<ul>${itemLines}</ul>` : ""}
      <p><strong>Total: $${Number(order.total_amount ?? 0).toFixed(2)}</strong></p>
      ${order.notes ? `<p><em>Notes: ${order.notes}</em></p>` : ""}
      <hr/>
      <p style="color:#888;font-size:12px">Sweet Street Co — Meeker, OK</p>
    </div>`;

  try {
    const { default: fetch } = await import("node-fetch");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [order.customer_email as string],
        subject: `Order #${order.id} confirmed — Sweet Street Co`,
        html,
      }),
    });
  } catch {
    // Email failure should never block the order response
  }
}

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
    sendOrderConfirmationEmail(order as Record<string, unknown>, items ?? []);
    return res.status(201).json(orderToClient(order as Record<string, unknown>));
  }

  return err(res, 405, "Method not allowed");
}
