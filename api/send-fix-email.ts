import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { supabase, setCors, err } from "./_utils";
import { getSquareBaseUrl, normalizePhone, searchLoyaltyAccount } from "./loyalty/_square-loyalty";

async function awardSquarePoints(phone: string): Promise<void> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  try {
    const baseUrl = getSquareBaseUrl();
    const account = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!account) return;
    const { default: fetch } = await import("node-fetch");
    await fetch(`${baseUrl}/v2/loyalty/events/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `feedback-reward-${account.id}-${Date.now()}`,
        loyalty_account_id: account.id,
        adjust_points: { points: 5, reason: "Bug report reward" },
      }),
    });
  } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { to, customerName, issueTitle, clerkUserId } = req.body ?? {};
  if (!to) return err(res, 400, "Missing 'to' email address");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return err(res, 503, "Email service not configured");

  const resend = new Resend(resendKey);
  const name = customerName ?? "there";

  const { error } = await resend.emails.send({
    from: "Sweet Street <noreply@sweetstreetco.com>",
    to: [to],
    subject: "Your issue has been fixed — Sweet Street",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="color:#e85d04">Good news, ${name}!</h2>
        <p>We found and fixed the bug you reported${issueTitle ? ` (<em>${issueTitle}</em>)` : ""} on sweetstreetco.com.</p>
        <p>The fix is live now — give it another try!</p>
        <p>As a thank-you for helping us improve, we've added <strong>5 Sweet Street points</strong> to your loyalty account.</p>
        <p style="color:#888;font-size:13px">Thanks for letting us know. — Sweet Street, Meeker OK</p>
      </div>
    `,
    idempotencyKey: `fix-email/${Buffer.from(to + (issueTitle ?? "")).toString("base64").slice(0, 40)}`,
  });

  if (error) return err(res, 500, error.message);

  // Award 5 points via Square Loyalty (look up account by saved phone)
  if (clerkUserId) {
    const { data: profile } = await supabase()
      .from("user_profiles")
      .select("phone_number")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();

    if (profile?.phone_number) {
      awardSquarePoints(profile.phone_number).catch(() => {});
    } else {
      // Fallback: mirror in points_ledger for users without a saved phone
      supabase().from("points_ledger").insert({
        clerk_user_id: clerkUserId,
        points: 5,
        type: "feedback_reward",
        description: "Thanks for reporting a bug — we fixed it!",
      }).then(() => {}).catch(() => {});
    }
  }

  return res.json({ ok: true });
}
