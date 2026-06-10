import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" });
}
