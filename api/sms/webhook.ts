import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { supabase, getShopTimeInfo } from "../_utils";
import { normalizePhone } from "../loyalty/_square-loyalty";

/**
 * "Sweet Street Buddy" SMS assistant — Twilio webhook for incoming texts.
 *
 * Setup:
 *  1. Buy a phone number on https://www.twilio.com (~$1/mo + ~$0.0079/SMS).
 *  2. In the Twilio console, set the number's "A MESSAGE COMES IN" webhook to
 *     POST https://<your-domain>/api/sms/webhook
 *  3. Set these env vars (Vercel + Render):
 *       ANTHROPIC_API_KEY   — Claude API key
 *       TWILIO_ACCOUNT_SID  — from the Twilio console
 *       TWILIO_AUTH_TOKEN   — from the Twilio console (used to verify webhook signatures)
 *       OWNER_PHONE_NUMBER  — your cell number(s), comma-separated, e.g. "+14055551234"
 *                             (only these numbers get AI replies)
 *       PUBLIC_BASE_URL     — optional, e.g. "https://www.sweetstreetco.com"
 *                             (set if Twilio signature validation fails behind a proxy)
 */

function buildReplyXml(message?: string): string {
  const response = new twilio.twiml.MessagingResponse();
  if (message) response.message(message);
  return response.toString();
}

function isAuthorizedTwilioRequest(req: VercelRequest): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // not configured — allow (e.g. local testing)

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host as string;
  const url = base ? `${base}${req.url}` : `${proto}://${host}${req.url}`;

  return twilio.validateRequest(authToken, signature, url, (req.body ?? {}) as Record<string, string>);
}

async function buildShopContext(): Promise<string> {
  const sb = supabase();

  const [{ data: settings }, { data: pendingOrders }, { data: menuItems }] = await Promise.all([
    sb.from("settings")
      .select("shop_name, is_open, announcement_enabled, announcement_text, happy_hour_enabled, happy_hour_start, happy_hour_end")
      .eq("id", 1)
      .maybeSingle(),
    sb.from("orders").select("total_amount").eq("status", "pending"),
    sb.from("menu_items").select("name, size_prices").eq("available", true).order("pos_sort_order"),
  ]);

  const shopTime = getShopTimeInfo();
  const shopName = settings?.shop_name ?? "Sweet Street Co";
  const pendingCount = pendingOrders?.length ?? 0;
  const pendingTotal = (pendingOrders ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  const menuLines = (menuItems ?? []).map((m) => {
    const prices = Object.values((m.size_prices ?? {}) as Record<string, number>).filter((p) => p > 0);
    if (prices.length === 0) return `- ${m.name}`;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `- ${m.name}: $${min.toFixed(2)}` : `- ${m.name}: $${min.toFixed(2)}-$${max.toFixed(2)}`;
  });

  const lines = [
    `You are "Sweet Street Buddy", an AI assistant texting with the owner of ${shopName}, a dirty soda & sweet treats shop in Meeker, OK.`,
    `The owner is texting you from their phone for quick help. Reply naturally and conversationally, like a helpful friend texting back.`,
    `Keep replies SHORT and SMS-friendly (1-3 sentences). No markdown, no asterisks, no headers.`,
    ``,
    `CURRENT SHOP STATUS:`,
    `- Open sign: ${settings?.is_open ? "ON (open)" : "OFF (closed)"}`,
    `- Today's hours: ${shopTime.todayHours ?? "closed today"}`,
  ];
  if (shopTime.closingSoon && shopTime.minutesUntilClose !== null) {
    lines.push(`- Closing soon, in about ${shopTime.minutesUntilClose} minutes`);
  }
  if (!shopTime.todayHours && shopTime.nextOpenLabel) {
    lines.push(`- Next open: ${shopTime.nextOpenLabel}`);
  }
  lines.push(
    `- Happy hour: ${settings?.happy_hour_enabled ? `ON (${settings.happy_hour_start}-${settings.happy_hour_end})` : "off"}`,
    `- Announcement: ${settings?.announcement_enabled && settings.announcement_text ? settings.announcement_text : "none"}`,
    ``,
    `PENDING ORDERS: ${pendingCount} order(s) waiting, totaling $${pendingTotal.toFixed(2)}`,
    ``,
    `MENU (available items):`,
    ...(menuLines.length > 0 ? menuLines : ["(none)"]),
    ``,
    `Use this data to answer questions about shop status, pending orders, and the menu. For anything else, just be a friendly, helpful assistant. If asked to change settings or do something only possible from the owner dashboard, let them know to use the dashboard.`,
  );

  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  if (!isAuthorizedTwilioRequest(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  res.setHeader("Content-Type", "text/xml");

  const body = (req.body ?? {}) as Record<string, string>;
  const fromNumber = normalizePhone(body.From ?? "");
  const incomingMessage = (body.Body ?? "").trim();

  const allowedNumbers = (process.env.OWNER_PHONE_NUMBER ?? "")
    .split(",")
    .map((n) => normalizePhone(n.trim()))
    .filter((n): n is string => !!n);

  // Only reply to the configured owner number(s) — avoids surprise
  // Anthropic/Twilio costs if the number gets texted by someone else.
  if (allowedNumbers.length === 0 || !fromNumber || !allowedNumbers.includes(fromNumber)) {
    res.status(200).send(buildReplyXml());
    return;
  }

  if (!incomingMessage) {
    res.status(200).send(buildReplyXml());
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(200).send(buildReplyXml("Sweet Street Buddy isn't set up yet — ask your developer to add an ANTHROPIC_API_KEY."));
    return;
  }

  try {
    const system = await buildShopContext();
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: incomingMessage }],
    });

    let reply = "";
    for (const block of message.content) {
      if (block.type === "text") reply += block.text;
    }

    res.status(200).send(buildReplyXml(reply.trim() || "Sorry, I didn't catch that — try again?"));
  } catch (e) {
    console.error("Sweet Street Buddy SMS error:", e instanceof Error ? e.message : e);
    res.status(200).send(buildReplyXml("Sorry, I'm having trouble right now. Try again in a bit!"));
  }
}
