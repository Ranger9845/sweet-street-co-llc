import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

const DEV_EMAIL = (process.env.DEV_CONSOLE_EMAIL ?? "ldfarris2007@gmail.com").toLowerCase();

function isDevCaller(req: VercelRequest): boolean {
  const email = (req.headers["x-clerk-user-email"] as string | undefined)?.toLowerCase();
  return !!email && email === DEV_EMAIL;
}

function toClient(row: Record<string, unknown>) {
  return {
    id: row.id,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    note: row.note,
  };
}

function secondsBetween(start: string, end: string | null): number {
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.round((b - a) / 1000));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!isDevCaller(req)) return err(res, 403, "Forbidden");

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("dev_sessions")
      .select("*")
      .eq("clerk_email", DEV_EMAIL)
      .order("clock_in_at", { ascending: false })
      .limit(50);
    if (error) return err(res, 400, error.message);

    const rows = data ?? [];
    const active = rows.find((r) => !r.clock_out_at) ?? null;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    let totalTodaySeconds = 0;
    let totalWeekSeconds = 0;
    let totalAllSeconds = 0;
    for (const r of rows) {
      const secs = secondsBetween(r.clock_in_at as string, r.clock_out_at as string | null);
      totalAllSeconds += secs;
      const inAt = new Date(r.clock_in_at as string);
      if (inAt >= startOfWeek) totalWeekSeconds += secs;
      if (inAt >= startOfToday) totalTodaySeconds += secs;
    }

    return res.status(200).json({
      active: active ? toClient(active) : null,
      sessions: rows.slice(0, 20).map(toClient),
      totals: {
        todaySeconds: totalTodaySeconds,
        weekSeconds: totalWeekSeconds,
        allSeconds: totalAllSeconds,
      },
    });
  }

  if (req.method === "POST") {
    const action: string = req.body?.action;
    const note: string | null = req.body?.note ?? null;

    if (action === "in") {
      const { data: existing } = await sb
        .from("dev_sessions")
        .select("id")
        .eq("clerk_email", DEV_EMAIL)
        .is("clock_out_at", null)
        .maybeSingle();
      if (existing) return err(res, 409, "Already clocked in");

      const { data, error } = await sb
        .from("dev_sessions")
        .insert({ clerk_email: DEV_EMAIL, clock_in_at: new Date().toISOString(), note })
        .select()
        .single();
      if (error) return err(res, 400, error.message);
      return res.status(201).json(toClient(data));
    }

    if (action === "out") {
      const { data: existing, error: findError } = await sb
        .from("dev_sessions")
        .select("*")
        .eq("clerk_email", DEV_EMAIL)
        .is("clock_out_at", null)
        .maybeSingle();
      if (findError) return err(res, 400, findError.message);
      if (!existing) return err(res, 409, "Not clocked in");

      const { data, error } = await sb
        .from("dev_sessions")
        .update({ clock_out_at: new Date().toISOString(), ...(note ? { note } : {}) })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return err(res, 400, error.message);
      return res.status(200).json(toClient(data));
    }

    return err(res, 400, "action must be 'in' or 'out'");
  }

  return err(res, 405, "Method not allowed");
}
