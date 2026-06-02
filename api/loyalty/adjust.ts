import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err, requireOwner } from "../_utils";
import { getSquareBaseUrl, normalizePhone, searchLoyaltyAccount, createLoyaltyAccount } from "./_square-loyalty";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  if (!(await requireOwner(req))) return err(res, 403, "Forbidden");

  const { phone, points, reason } = req.body ?? {};
  if (!phone || !points) return err(res, 400, "phone and points are required");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return err(res, 500, "Square not configured");

  const normalized = normalizePhone(phone);
  if (!normalized) return err(res, 400, "Invalid phone number");

  const baseUrl = getSquareBaseUrl();

  try {
    let account = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!account) account = await createLoyaltyAccount(baseUrl, token, normalized);
    if (!account) return err(res, 404, "Could not find or create loyalty account");

    const { default: fetch } = await import("node-fetch");
    const adjustRes = await fetch(`${baseUrl}/v2/loyalty/events/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `adjust-${account.id}-${Date.now()}`,
        loyalty_account_id: account.id,
        adjust_points: {
          points: Number(points),
          reason: reason ?? "Manual adjustment",
        },
      }),
    });

    const data = (await adjustRes.json()) as { event?: object; errors?: { detail: string }[] };
    if (!adjustRes.ok || data.errors) throw new Error(data.errors?.[0]?.detail ?? "Adjust failed");

    const updated = await searchLoyaltyAccount(baseUrl, token, normalized);
    return res.json({ ok: true, newBalance: updated?.balance ?? null });
  } catch (e: unknown) {
    return err(res, 500, e instanceof Error ? e.message : "Adjust failed");
  }
}
