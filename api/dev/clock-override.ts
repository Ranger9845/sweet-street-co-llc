import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

const DEV_KEY = "ranger";

// Lets developers fast-forward/rewind the shop's notion of "now" so they can
// preview schedule-based behavior (open/closed, happy hour, closing-soon
// banners) without waiting for real time to pass. Stored in the settings row
// so it survives across serverless invocations; null/absent means "use real time".
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const devKey = req.headers["x-dev-key"] as string | undefined;
  if (devKey !== DEV_KEY) return err(res, 403, "Forbidden");

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("settings").select("dev_clock_override").eq("id", 1).maybeSingle();
    if (error) return err(res, 500, error.message);
    return res.json({ override: data?.dev_clock_override ?? null, serverTime: new Date().toISOString() });
  }

  if (req.method === "POST") {
    const { override } = req.body ?? {};
    if (override !== null && (typeof override !== "string" || isNaN(Date.parse(override)))) {
      return err(res, 400, "override must be an ISO date string or null");
    }

    const { error } = await sb.from("settings").update({ dev_clock_override: override }).eq("id", 1);
    if (error) return err(res, 500, error.message);
    return res.json({ ok: true, override });
  }

  return err(res, 405, "Method not allowed");
}
