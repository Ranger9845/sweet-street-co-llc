import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err } from "../_utils";
import { getSquareBaseUrl, normalizePhone, searchLoyaltyAccount } from "./_square-loyalty";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const rawPhone = req.query.phone as string | undefined;
  if (!rawPhone) return err(res, 400, "phone query parameter is required");

  const phone = normalizePhone(rawPhone);
  if (!phone) return err(res, 400, "Invalid phone number — must be a US number");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return err(res, 500, "Square not configured");

  const baseUrl = getSquareBaseUrl();

  try {
    const account = await searchLoyaltyAccount(baseUrl, token, phone);
    if (!account) {
      return res.json({ found: false, balance: 0 });
    }

    return res.json({
      found: true,
      accountId: account.id,
      balance: account.balance ?? 0,
      lifetimePoints: account.lifetime_points ?? 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to look up loyalty account";
    return err(res, 500, msg);
  }
}
