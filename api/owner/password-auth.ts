import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils.js";

const DEFAULT_OWNER_EMAIL = process.env.OWNER_EMAIL ?? "ldfarris2007@gmail.com";

async function getAllowedEmails(): Promise<string[]> {
  const envEmails = process.env.OWNER_EMAILS;
  if (envEmails) {
    return envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  try {
    const { data } = await supabase()
      .from("settings")
      .select("allowed_owner_emails")
      .eq("id", 1)
      .maybeSingle();
    const list: string[] = data?.allowed_owner_emails ?? [];
    if (list.length > 0) return list.map((e) => e.toLowerCase());
  } catch {}
  return [DEFAULT_OWNER_EMAIL.toLowerCase()];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { email, password } = req.body ?? {};
  if (!email || !password) return err(res, 400, "Email and password required");

  const allowed = await getAllowedEmails();
  if (!allowed.includes((email as string).toLowerCase())) return err(res, 401, "Invalid credentials");

  const validPassword = process.env.OWNER_PASSWORD ?? "owner123";
  if (password !== validPassword) return err(res, 401, "Invalid credentials");

  return res.json({ token: validPassword });
}
