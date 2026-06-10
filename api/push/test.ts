import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, requireOwner, err, sendPushToOwners } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const result = await sendPushToOwners({
    title: "Sweet Street Co",
    body: "Push notifications are working! 🎉",
    url: "/owner",
    tag: "sweetstreet-test",
  });

  return res.json({ success: true, ...result });
}
