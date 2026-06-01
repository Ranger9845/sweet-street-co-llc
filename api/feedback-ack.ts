import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { setCors, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const { email, name } = req.body ?? {};
  if (!email) return err(res, 400, "Missing email");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return err(res, 503, "Email service not configured");

  const resend = new Resend(resendKey);
  const displayName = name || "there";

  const { error } = await resend.emails.send({
    from: "Sweet Street <noreply@sweetstreetco.com>",
    to: [email],
    subject: "We got your feedback — Sweet Street",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="color:#e85d04">Thanks, ${displayName}!</h2>
        <p>We received your feedback and our team is already looking into it.</p>
        <p>If you reported a bug, we'll send you another email once it's fixed.</p>
        <p style="color:#888;font-size:13px">— Sweet Street, Meeker OK</p>
      </div>
    `,
  });

  if (error) return err(res, 500, error.message);
  return res.json({ ok: true });
}
