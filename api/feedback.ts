import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { supabase, setCors, err } from "./_utils";

const OWNER_EMAIL = "ldfarris2007@gmail.com";
const FROM_ADDRESS = "Sweet Street <noreply@sweetstreetco.com>";

const BUG_KEYWORDS = [
  "bug", "error", "broken", "doesn't work", "doesnt work", "not working",
  "isn't working", "isnt working", "can't", "cant", "won't", "wont",
  "issue", "problem", "fix", "crash", "fail", "404", "500", "wrong",
  "missing", "blank", "loading", "stuck", "slow", "timeout", "freezing",
  "payment", "won't load", "wont load", "won't open", "doesn't load",
];

// Preset issue IDs from the feedback widget that always indicate a bug
const BUG_ISSUE_IDS = new Set(["app_broken", "payment_issue", "order_wrong", "missing_item"]);

function looksLikeBugReport(text: string, issueId?: string | null): boolean {
  if (issueId && BUG_ISSUE_IDS.has(issueId)) return true;
  const lower = text.toLowerCase();
  return BUG_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildOwnerEmail(fields: {
  name: string;
  email: string | null;
  issue: string | null;
  message: string | null;
  orderInfo: Record<string, string> | null;
  log: Record<string, string> | null;
}) {
  const { name, email, issue, message, orderInfo, log } = fields;
  const lines: string[] = [];

  if (issue) lines.push(`<p><strong>Issue type:</strong> ${issue}</p>`);
  if (message) lines.push(`<p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>`);
  if (email) lines.push(`<p><strong>Customer email:</strong> <a href="mailto:${email}">${email}</a></p>`);

  if (orderInfo) {
    lines.push(`<hr><p><strong>Order #${orderInfo.orderId}</strong> — ${orderInfo.orderDate}<br>${orderInfo.orderItems} — ${orderInfo.orderTotal}</p>`);
  }

  if (log) {
    lines.push(`<hr><p style="font-size:12px;color:#888"><strong>Browser info:</strong><br>${log.userAgent}<br>Screen: ${log.screen} · Viewport: ${log.viewport}<br>Page: ${log.url}<br>Time: ${log.timestamp}</p>`);
  }

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222">
      <h2 style="color:#e85d04">Sweet Street — Customer Feedback</h2>
      <p><strong>From:</strong> ${name}</p>
      ${lines.join("\n")}
      <hr>
      <p style="font-size:12px;color:#aaa">Sent automatically from sweetstreetco.com</p>
    </div>
  `;
}

async function createGitHubIssue(name: string, rating: number, message: string, email: string | null, clerkUserId: string | null) {
  const token = process.env.GITHUB_ISSUES_TOKEN;
  if (!token) return;

  const title = `Customer feedback (${rating}★): ${message.slice(0, 60)}${message.length > 60 ? "…" : ""}`;
  const body = [
    `**From:** ${name}`,
    email ? `**Email:** ${email}` : null,
    clerkUserId ? `**Clerk User ID:** ${clerkUserId}` : null,
    `**Rating:** ${rating}/5`,
    "",
    "**Message:**",
    message,
    "",
    "---",
    "_Auto-created from customer feedback form_",
  ]
    .filter((l) => l !== null)
    .join("\n");

  await fetch("https://api.github.com/repos/Ranger9845/sweet-street-co-llc/issues", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ title, body, labels: ["customer-feedback"] }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  const name: string = body.name ?? "Anonymous";
  const rating: number = body.rating ?? 5;
  const message: string = body.comment ?? body.message ?? "";
  const email: string | null = body.email ?? null;
  const clerkUserId: string | null = body.clerkUserId ?? null;
  const issue: string | null = body.issue ?? null;
  const orderInfo: Record<string, string> | null = body.orderInfo ?? null;
  const log: Record<string, string> | null = body.log ?? null;

  const fullMessage = [issue, message].filter(Boolean).join(" — ");

  // Try insert with extended columns; fall back to base columns if they don't exist yet
  let insertResult = await supabase()
    .from("reviews")
    .insert({
      reviewer_name: name,
      rating,
      comment: fullMessage || message,
      approved: "pending",
      customer_email: email,
      issue_type: issue,
      order_info: orderInfo,
    })
    .select()
    .single();

  if (insertResult.error?.message?.includes("column")) {
    insertResult = await supabase()
      .from("reviews")
      .insert({ reviewer_name: name, rating, comment: fullMessage || message, approved: "pending" })
      .select()
      .single();
  }

  const { data, error } = insertResult;
  if (error) return err(res, 400, error.message);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const reviewId = data.id as string;

    const { error: ownerEmailError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [OWNER_EMAIL],
      replyTo: email ?? undefined,
      subject: `[Sweet Street Feedback] ${issue ?? "General"} from ${name}`,
      html: buildOwnerEmail({ name, email, issue, message, orderInfo, log }),
      idempotencyKey: `feedback-owner/${reviewId}`,
    });
    if (ownerEmailError) console.error("Owner email failed:", ownerEmailError.message);

    // For non-bug reports only — bug reports get their ack when Claude starts working on them
    const isBug = looksLikeBugReport(fullMessage, issueId);
    if (email && !isBug) {
      const { error: ackEmailError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [email],
        subject: "We got your feedback — Sweet Street",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
            <h2 style="color:#e85d04">Thanks, ${name}!</h2>
            <p>We received your feedback and will look into it.</p>
            <p style="color:#888;font-size:13px">— Sweet Street, Meeker OK</p>
          </div>
        `,
        idempotencyKey: `feedback-ack/${reviewId}`,
      });
      if (ackEmailError) console.error("Customer ack email failed:", ackEmailError.message);
    }
  }

  const issueId: string | null = body.issueId ?? null;
  if (looksLikeBugReport(fullMessage, issueId)) {
    createGitHubIssue(name, rating, fullMessage, email, clerkUserId).catch(() => {});
  }

  return res.status(201).json(data);
}
