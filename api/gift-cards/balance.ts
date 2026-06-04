import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { gan } = req.body ?? {};
  if (!gan) return err(res, 400, "Gift card number is required");

  const cleanGan = String(gan).replace(/\s/g, "");
  const sb = supabase();

  const { data: gcRow } = await sb
    .from("gift_cards")
    .select("square_gift_card_id, amount_cents")
    .eq("gan", cleanGan)
    .maybeSingle();

  if (!gcRow) return err(res, 404, "Gift card not found. Check the number and try again.");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return res.json({ gan: cleanGan, balanceCents: gcRow.amount_cents });
  }

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    const gcRes = await fetch(`${baseUrl}/v2/gift-cards/${gcRow.square_gift_card_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const gcData = (await gcRes.json()) as {
      gift_card?: { balance_money?: { amount: number }; state?: string };
      errors?: { detail: string }[];
    };

    if (!gcRes.ok || gcData.errors) {
      return err(res, 500, gcData.errors?.[0]?.detail ?? "Failed to retrieve balance");
    }

    const balanceCents = gcData.gift_card?.balance_money?.amount ?? 0;
    const state = gcData.gift_card?.state ?? "ACTIVE";

    if (state === "DEACTIVATED") {
      return err(res, 400, "This gift card has been deactivated.");
    }

    return res.json({ gan: cleanGan, balanceCents });
  } catch (e) {
    console.error("[gift-cards/balance]", e);
    return err(res, 500, "Failed to check gift card balance");
  }
}
