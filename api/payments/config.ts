import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const applicationId = process.env.SQUARE_APPLICATION_ID ?? null;
  const locationId = process.env.SQUARE_LOCATION_ID ?? null;
  const environment = process.env.SQUARE_ENVIRONMENT ?? "sandbox";

  return res.json({
    configured: !!(applicationId && locationId),
    applicationId,
    locationId,
    environment,
  });
}
