import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, requireOwner, err } from "../_utils";

// POST /api/owner/verify — returns 200 if x-owner-password header is valid
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");
  return res.status(200).json({ ok: true });
}
