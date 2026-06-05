import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";
import { getSquareBaseUrl, normalizePhone, searchLoyaltyAccount, createLoyaltyAccount } from "../loyalty/_square-loyalty";

async function ensureSquareLoyaltyAccount(phone: string): Promise<void> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  try {
    const baseUrl = getSquareBaseUrl();
    const existing = await searchLoyaltyAccount(baseUrl, token, normalized);
    if (!existing) await createLoyaltyAccount(baseUrl, token, normalized);
  } catch (e) {
    console.error("[user/profile] Square loyalty account creation failed:", e instanceof Error ? e.message : e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  // GET /api/user/profile?clerkUserId=xxx
  if (req.method === "GET") {
    const clerkUserId = req.query.clerkUserId as string | undefined;
    if (!clerkUserId) return err(res, 400, "clerkUserId query parameter is required");

    const { data, error } = await sb
      .from("user_profiles")
      .select("phone_number")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();

    if (error) return err(res, 500, error.message);
    return res.json({ phone_number: data?.phone_number ?? null });
  }

  // POST /api/user/profile — upsert { clerkUserId, phoneNumber }
  if (req.method === "POST") {
    const { clerkUserId, phoneNumber } = req.body ?? {};
    if (!clerkUserId) return err(res, 400, "clerkUserId is required");
    if (!phoneNumber) return err(res, 400, "phoneNumber is required");

    const { error } = await sb
      .from("user_profiles")
      .upsert(
        { clerk_user_id: clerkUserId, phone_number: phoneNumber },
        { onConflict: "clerk_user_id" },
      );

    if (error) return err(res, 500, error.message);

    // Create Square loyalty account in the background so the customer
    // starts earning points immediately on their first order.
    ensureSquareLoyaltyAccount(phoneNumber);

    return res.json({ ok: true });
  }

  return err(res, 405, "Method not allowed");
}
