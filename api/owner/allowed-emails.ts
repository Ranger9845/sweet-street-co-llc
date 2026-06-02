import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await requireOwner(req))) return err(res, 403, "Forbidden");
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  try {
    const { data } = await supabase()
      .from("settings")
      .select("allowed_owner_emails")
      .eq("id", 1)
      .maybeSingle();

    const emails: string[] = data?.allowed_owner_emails ?? ["ldfarris2007@gmail.com"];
    return res.json({ emails });
  } catch {
    return res.json({ emails: ["ldfarris2007@gmail.com"] });
  }
}
