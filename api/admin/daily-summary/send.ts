import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const { daysAgo = 0 } = req.body ?? {};
  const sb = supabase();

  const date = new Date();
  date.setDate(date.getDate() - Number(daysAgo));
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const { data: orders } = await sb
    .from("orders")
    .select("total_amount, status")
    .gte("created_at", date.toISOString())
    .lt("created_at", nextDay.toISOString());

  const total = (orders ?? []).reduce((s, o) => s + Number(o.total_amount), 0);
  const count = orders?.length ?? 0;

  // Email sending would require a service like Resend/SendGrid configured via env vars.
  // For now we return the summary data.
  return res.json({
    sent: false,
    summary: { date: date.toISOString().split("T")[0], orderCount: count, revenue: total },
    message: "Email service not configured. Set RESEND_API_KEY and SUMMARY_EMAIL env vars to enable.",
  });
}
