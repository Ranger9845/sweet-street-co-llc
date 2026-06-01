import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { setCors, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { to, customerName, issueTitle } = req.body ?? {};
  if (!to) return err(res, 400, "Missing 'to' email address");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return err(res, 503, "Email service not configured");

  const resend = new Resend(resendKey);
  const name = customerName ?? "there";

  const { error } = await resend.emails.send({
    from: "Sweet Street <noreply@sweetstreetco.com>",
    to: [to],
    subject: "Your issue has been fixed — Sweet Street",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="color:#e85d04">Good news, ${name}!</h2>
        <p>We found and fixed the bug you reported${issueTitle ? ` (<em>${issueTitle}</em>)` : ""} on sweetstreetco.com.</p>
        <p>The fix is live now — give it another try!</p>
        <p style="color:#888;font-size:13px">Thanks for letting us know. — Sweet Street, Meeker OK</p>
      </div>
    `,
    idempotencyKey: `fix-email/${Buffer.from(to + (issueTitle ?? "")).toString("base64").slice(0, 40)}`,
  });

  if (error) return err(res, 500, error.message);
  return res.json({ ok: true });
}
