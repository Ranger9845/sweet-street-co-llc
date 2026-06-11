import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token || !locationId) return err(res, 500, "Square not configured");

  const body = req.body ?? {};
  const { sourceId, amountCents, recipientName, recipientEmail, recipientMessage, buyerName, buyerEmail, clerkUserId } = body;

  if (!sourceId) return err(res, 400, "Payment token is required");
  if (!amountCents || amountCents < 500) return err(res, 400, "Minimum gift card amount is $5.00");
  if (amountCents > 50000) return err(res, 400, "Maximum gift card amount is $500.00");
  if (!recipientEmail) return err(res, 400, "Recipient email is required");
  if (!buyerEmail) return err(res, 400, "Your email is required");

  const { default: fetch } = await import("node-fetch");
  const baseUrl = getSquareBaseUrl();

  try {
    // 1. Charge the buyer
    const payRes = await fetch(`${baseUrl}/v2/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: `gc-pay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        amount_money: { amount: amountCents, currency: "USD" },
        location_id: locationId,
      }),
    });
    const payData = (await payRes.json()) as { payment?: { id: string }; errors?: { detail: string }[] };
    if (!payRes.ok || payData.errors) {
      return err(res, 400, payData.errors?.[0]?.detail ?? "Payment failed");
    }
    const paymentId = payData.payment!.id;

    // 2. Create digital gift card in Square
    const createRes = await fetch(`${baseUrl}/v2/gift-cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `gc-create-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        location_id: locationId,
        gift_card: { type: "DIGITAL" },
      }),
    });
    const createData = (await createRes.json()) as {
      gift_card?: { id: string; gan: string };
      errors?: { detail: string }[];
    };
    if (!createRes.ok || createData.errors || !createData.gift_card) {
      console.error("[gift-cards/purchase] create error:", createData.errors);
      return err(res, 500, createData.errors?.[0]?.detail ?? "Failed to create gift card");
    }

    const { id: squareGiftCardId, gan } = createData.gift_card;

    // 3. Load gift card with the purchased amount, linking the payment
    const loadRes = await fetch(`${baseUrl}/v2/gift-card-activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `gc-load-${squareGiftCardId}-${Date.now()}`,
        gift_card_activity: {
          type: "LOAD",
          location_id: locationId,
          gift_card_id: squareGiftCardId,
          load_activity_details: {
            amount_money: { amount: amountCents, currency: "USD" },
            buyer_payment_instrument_ids: [paymentId],
          },
        },
      }),
    });
    const loadData = (await loadRes.json()) as { errors?: { detail: string }[] };
    if (!loadRes.ok || loadData.errors) {
      console.error("[gift-cards/purchase] load error:", loadData.errors);
    }

    // 4. Store in Supabase
    const sb = supabase();
    await sb.from("gift_cards").insert({
      square_gift_card_id: squareGiftCardId,
      gan,
      amount_cents: amountCents,
      recipient_name: recipientName ?? null,
      recipient_email: recipientEmail,
      buyer_name: buyerName ?? null,
      buyer_email: buyerEmail,
      message: recipientMessage ?? null,
      clerk_user_id: clerkUserId ?? null,
      square_payment_id: paymentId,
    }).then(() => {}).catch((e: Error) => console.error("[gift-cards/purchase] db insert:", e.message));

    // 5. Email the recipient (fire-and-forget)
    sendGiftCardEmail({
      recipientName: recipientName || recipientEmail.split("@")[0],
      recipientEmail,
      buyerName: buyerName || "Someone special",
      gan,
      amountCents,
      message: recipientMessage ?? null,
    }).catch(() => {});

    return res.status(201).json({ success: true, gan, amountCents });
  } catch (e) {
    console.error("[gift-cards/purchase]", e);
    return err(res, 500, "Failed to purchase gift card");
  }
}

async function sendGiftCardEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  buyerName: string;
  gan: string;
  amountCents: number;
  message: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const { recipientName, recipientEmail, buyerName, gan, amountCents, message } = opts;
  const amount = (amountCents / 100).toFixed(2);
  const formattedGan = gan.replace(/(.{4})/g, "$1 ").trim();

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fdf4f8;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(180,50,120,0.12);">
  <div style="background:linear-gradient(135deg,#c2185b 0%,#e91e8c 50%,#f06292 100%);padding:40px 32px 32px;text-align:center;">
    <p style="color:rgba(255,255,255,0.8);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;margin:0 0 10px;">Sweet Street Co · Meeker, OK</p>
    <h1 style="color:#fff;font-size:30px;font-weight:800;margin:0 0 6px;line-height:1.2;">🎁 You got a gift card!</h1>
    <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0;">${buyerName} sent you something sweet</p>
  </div>

  <div style="padding:32px;">
    <div style="background:linear-gradient(135deg,#fce4ec,#fdf2f8);border:2px solid #f48fb1;border-radius:14px;padding:28px 24px;text-align:center;margin-bottom:24px;">
      <p style="color:#880e4f;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 8px;">Gift Card Value</p>
      <p style="color:#c2185b;font-size:44px;font-weight:800;margin:0 0 20px;line-height:1;">$${amount}</p>
      <p style="color:#9e9e9e;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px;">Card Number</p>
      <div style="background:#fff;border:1.5px solid #e0e0e0;border-radius:10px;padding:12px 20px;display:inline-block;">
        <p style="color:#212121;font-size:20px;font-weight:700;letter-spacing:0.14em;font-family:'Courier New',monospace;margin:0;">${formattedGan}</p>
      </div>
    </div>

    ${message ? `<div style="background:#f1f8e9;border:1px solid #c5e1a5;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#33691e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px;">A note from ${buyerName}</p>
      <p style="color:#37474f;font-size:14px;line-height:1.65;margin:0;font-style:italic;">"${message}"</p>
    </div>` : ""}

    <p style="color:#616161;font-size:13px;line-height:1.7;margin:0 0 20px;text-align:center;">
      Use this card at sweetstreetco.com or just read the number at our counter — it works on our Square register too!
    </p>

    <div style="text-align:center;">
      <a href="https://sweetstreetco.com/order" style="display:inline-block;background:linear-gradient(135deg,#c2185b,#e91e8c);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 32px;border-radius:50px;letter-spacing:0.02em;">Order now →</a>
    </div>
  </div>

  <div style="border-top:1px solid #f5f5f5;padding:18px 32px;text-align:center;">
    <p style="color:#bdbdbd;font-size:11px;margin:0;">Sweet Street Co · Meeker, OK · sweetstreetco.com</p>
  </div>
</div>
</body>
</html>`;

  const { default: fetch } = await import("node-fetch");
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "orders@sweetstreetco.com",
      to: [recipientEmail],
      subject: `🎁 ${buyerName} sent you a $${amount} Sweet Street gift card!`,
      html,
    }),
  });
}
