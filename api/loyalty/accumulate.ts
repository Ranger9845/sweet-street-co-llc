import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err } from "../_utils";
import {
  getSquareBaseUrl,
  normalizePhone,
  searchLoyaltyAccount,
  createLoyaltyAccount,
  accumulateLoyaltyPoints,
} from "./_square-loyalty";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  const { phone: rawPhone, orderId, amountDollars } = body as {
    phone?: string;
    orderId?: string;
    amountDollars?: number;
  };

  if (!rawPhone) return err(res, 400, "phone is required");
  if (!orderId) return err(res, 400, "orderId is required");

  const phone = normalizePhone(rawPhone);
  if (!phone) return err(res, 400, "Invalid phone number — must be a US number");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return err(res, 500, "Square not configured");

  const baseUrl = getSquareBaseUrl();

  try {
    // Search for existing account, create if missing
    let account = await searchLoyaltyAccount(baseUrl, token, phone);
    if (!account) {
      account = await createLoyaltyAccount(baseUrl, token, phone);
    }

    if (!account) {
      return err(res, 500, "Failed to find or create loyalty account");
    }

    // Accumulate points via Square
    const updatedAccount = await accumulateLoyaltyPoints(
      baseUrl,
      token,
      account.id,
      orderId,
    );

    return res.json({
      ok: true,
      accountId: account.id,
      newBalance: updatedAccount?.balance ?? account.balance ?? 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to accumulate loyalty points";
    return err(res, 500, msg);
  }
}
