import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Shop hours for Sweet Street Co (Meeker, OK — Central Time)
const SHOP_SCHEDULE: ({ open: number; close: number } | null)[] = [
  null,                    // 0 Sun: closed (restock day)
  { open: 7, close: 19 }, // 1 Mon: 7am–7pm
  { open: 7, close: 19 }, // 2 Tue
  { open: 7, close: 19 }, // 3 Wed
  { open: 7, close: 19 }, // 4 Thu
  { open: 7, close: 20 }, // 5 Fri: 7am–8pm
  { open: 8, close: 20 }, // 6 Sat: 8am–8pm
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtHour(h: number): string {
  if (h === 12) return "12:00 PM";
  return h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
}

export function getShopTimeInfo() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);

  const dow = new Date(get("year"), get("month") - 1, get("day")).getDay(); // 0=Sun
  const hourDecimal = get("hour") + get("minute") / 60;
  const isSunday = dow === 0;
  const today = SHOP_SCHEDULE[dow] ?? null;

  const todayHours = today ? `${fmtHour(today.open)} – ${fmtHour(today.close)}` : null;
  const withinHours = !!(today && hourDecimal >= today.open && hourDecimal < today.close);
  const minutesUntilClose = today && withinHours ? Math.round((today.close - hourDecimal) * 60) : null;
  const closingSoon = !!(withinHours && minutesUntilClose !== null && minutesUntilClose <= 30);
  const shopClosedByHours = !withinHours;

  let nextOpenLabel: string | null = null;
  for (let i = 1; i <= 7; i++) {
    const nextDow = (dow + i) % 7;
    const nextSched = SHOP_SCHEDULE[nextDow];
    if (nextSched) {
      nextOpenLabel = i === 1
        ? `tomorrow at ${fmtHour(nextSched.open)}`
        : `${DAY_NAMES[nextDow]} at ${fmtHour(nextSched.open)}`;
      break;
    }
  }

  return { isSunday, todayHours, closingSoon, minutesUntilClose, shopClosedByHours, nextOpenLabel };
}

export function supabase(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-owner-password, x-dev-key, Authorization, x-clerk-user-email");
}

export async function requireOwner(req: VercelRequest): Promise<boolean> {
  const pw = req.headers["x-owner-password"] as string | undefined;
  if (!pw) return false;

  // Env var takes priority — set OWNER_PASSWORD in Vercel to bypass DB/RLS issues
  const envPw = process.env.OWNER_PASSWORD;
  if (envPw) return pw === envPw;

  try {
    const sb = supabase();
    const { data } = await sb.from("settings").select("owner_password").eq("id", 1).maybeSingle();
    const stored = data?.owner_password ?? "owner123";
    return stored === pw;
  } catch {
    return false;
  }
}

export function err(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

// Convert a DB order row (snake_case) to the camelCase shape the frontend expects
export function orderToClient(o: Record<string, unknown>) {
  return {
    id: o.id,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    customerSmsConsent: o.customer_sms_consent,
    notes: o.notes,
    discountCode: o.discount_code,
    discountAmount: o.discount_amount,
    totalAmount: o.total_amount,
    status: o.status,
    source: o.source,
    clerkUserId: o.clerk_user_id,
    scheduledFor: o.scheduled_for,
    paidAt: o.paid_at,
    customerReadyNotifiedAt: o.customer_ready_notified_at,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: o.items,
  };
}
