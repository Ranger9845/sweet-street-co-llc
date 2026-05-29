import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export function supabase(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-owner-password, x-dev-key, Authorization");
}

export async function requireOwner(req: VercelRequest): Promise<boolean> {
  const pw = req.headers["x-owner-password"] as string | undefined;
  if (!pw) return false;
  const sb = supabase();
  const { data } = await sb.from("settings").select("owner_password").eq("id", 1).maybeSingle();
  return data?.owner_password === pw;
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
