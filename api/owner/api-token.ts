import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err } from "../_utils";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "ldfarris2007@gmail.com";

// GET /api/owner/api-token
// Reads x-clerk-user-email header and returns the owner API password if it matches.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const clerkEmail = req.headers["x-clerk-user-email"] as string | undefined;
  if (!clerkEmail || clerkEmail.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return err(res, 403, "Forbidden");
  }

  return res.status(200).json({ token: process.env.OWNER_PASSWORD ?? "owner123" });
}
