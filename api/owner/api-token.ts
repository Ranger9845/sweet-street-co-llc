import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils";

const DEFAULT_OWNER_EMAIL = process.env.OWNER_EMAIL ?? "ldfarris2007@gmail.com";

async function getAllowedEmails(): Promise<string[]> {
  // Env var takes priority: OWNER_EMAILS=email1@x.com,email2@x.com
  const envEmails = process.env.OWNER_EMAILS;
  if (envEmails) {
    return envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  }

  // Fall back to DB: settings.allowed_owner_emails (JSON array)
  try {
    const { data } = await supabase()
      .from("settings")
      .select("allowed_owner_emails")
      .eq("id", 1)
      .maybeSingle();
    const list: string[] = data?.allowed_owner_emails ?? [];
    if (list.length > 0) return list.map((e) => e.toLowerCase());
  } catch {}

  // Final fallback: single owner email
  return [DEFAULT_OWNER_EMAIL.toLowerCase()];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — verify a Clerk user email and return the API token
  if (req.method === "GET") {
    const clerkEmail = (req.headers["x-clerk-user-email"] as string | undefined)?.toLowerCase();
    if (!clerkEmail) return err(res, 403, "Forbidden");

    const allowed = await getAllowedEmails();
    if (!allowed.includes(clerkEmail)) return err(res, 403, "Forbidden");

    return res.status(200).json({ token: process.env.OWNER_PASSWORD ?? "owner123" });
  }

  // POST — save allowed emails list (requires existing owner auth)
  if (req.method === "POST") {
    const pw = req.headers["x-owner-password"] as string | undefined;
    const envPw = process.env.OWNER_PASSWORD;
    const stored = envPw ?? "owner123";
    if (!pw || pw !== stored) return err(res, 403, "Forbidden");

    const { emails } = req.body ?? {};
    if (!Array.isArray(emails)) return err(res, 400, "emails must be an array");

    const cleaned = emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean);

    // Always keep the default owner email
    if (!cleaned.includes(DEFAULT_OWNER_EMAIL.toLowerCase())) {
      cleaned.unshift(DEFAULT_OWNER_EMAIL.toLowerCase());
    }

    const { error } = await supabase()
      .from("settings")
      .update({ allowed_owner_emails: cleaned })
      .eq("id", 1);

    if (error) return err(res, 500, error.message);
    return res.json({ ok: true, emails: cleaned });
  }

  return err(res, 405, "Method not allowed");
}
