import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

// Map DB snake_case → app camelCase
function toClient(row: Record<string, unknown>) {
  return {
    id: row.id,
    shopName: row.shop_name,
    siteDescription: row.site_description,
    readyMessage: row.ready_message,
    ownerPassword: row.owner_password,
    isOpen: row.is_open,
    manualOpen: row.is_open, // alias used by settings page toggle
    announcementEnabled: row.announcement_enabled,
    announcementText: row.announcement_text,
    openMode: row.open_mode,
    happyHourEnabled: row.happy_hour_enabled,
    happyHourStart: row.happy_hour_start,
    happyHourEnd: row.happy_hour_end,
    happyHourDiscountType: row.happy_hour_discount_type,
    happyHourDiscountValue: row.happy_hour_discount_value,
    posAccentColor: row.pos_accent_color,
    posBgColor: row.pos_bg_color,
    posCardColor: row.pos_card_color,
    posForegroundColor: row.pos_foreground_color,
    posMutedColor: row.pos_muted_color,
    posBorderColor: row.pos_border_color,
    posHeaderText: row.pos_header_text,
    posButtonRadius: row.pos_button_radius,
    devNotificationEnabled: row.dev_notification_enabled,
    devNotificationTitle: row.dev_notification_title,
    devNotificationBody: row.dev_notification_body,
    devNotificationMaxShows: row.dev_notification_max_shows,
    devNotificationVersion: row.dev_notification_version,
    devNotificationCtaLabel: row.dev_notification_cta_label,
    devNotificationCtaUrl: row.dev_notification_cta_url,
  };
}

// Map app camelCase → DB snake_case (only known writable fields)
function toDb(body: Record<string, unknown>) {
  const map: Record<string, string> = {
    shopName: "shop_name",
    siteDescription: "site_description",
    readyMessage: "ready_message",
    ownerPassword: "owner_password",
    isOpen: "is_open",
    manualOpen: "is_open",
    announcementEnabled: "announcement_enabled",
    announcementText: "announcement_text",
    openMode: "open_mode",
    happyHourEnabled: "happy_hour_enabled",
    happyHourStart: "happy_hour_start",
    happyHourEnd: "happy_hour_end",
    happyHourDiscountType: "happy_hour_discount_type",
    happyHourDiscountValue: "happy_hour_discount_value",
    posAccentColor: "pos_accent_color",
    posBgColor: "pos_bg_color",
    posCardColor: "pos_card_color",
    posForegroundColor: "pos_foreground_color",
    posMutedColor: "pos_muted_color",
    posBorderColor: "pos_border_color",
    posHeaderText: "pos_header_text",
    posButtonRadius: "pos_button_radius",
    devNotificationEnabled: "dev_notification_enabled",
    devNotificationTitle: "dev_notification_title",
    devNotificationBody: "dev_notification_body",
    devNotificationMaxShows: "dev_notification_max_shows",
    devNotificationVersion: "dev_notification_version",
    devNotificationCtaLabel: "dev_notification_cta_label",
    devNotificationCtaUrl: "dev_notification_cta_url",
  };
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const col = map[k];
    if (col) result[col] = v;
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error) return err(res, 500, error.message);

    if (!data) {
      return res.json({
        isOpen: true, shopName: "Sweet Street Co.", siteDescription: "", readyMessage: "Your order is ready!",
        announcementEnabled: false, announcementText: "",
        happyHourEnabled: false, happyHourStart: "15:00", happyHourEnd: "17:00",
        happyHourDiscountType: "percent", happyHourDiscountValue: "50",
      });
    }

    const client = toClient(data as Record<string, unknown>);
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const start = parseTime((data.happy_hour_start as string) ?? "15:00");
    const end = parseTime((data.happy_hour_end as string) ?? "17:00");
    const isHappyHour = !!(data.happy_hour_enabled && hour >= start && hour < end);

    return res.json({ ...client, isHappyHour });
  }

  if (req.method === "PATCH") {
    const isOwner = await requireOwner(req);
    if (!isOwner) return err(res, 403, "Forbidden");

    const raw = req.body?.data ?? req.body;
    const { id: _id, ...rest } = raw;
    const fields = toDb(rest);

    const { data, error } = await sb.from("settings").update(fields).eq("id", 1).select().single();
    if (error) return err(res, 400, error.message);
    return res.json(toClient(data as Record<string, unknown>));
  }

  return err(res, 405, "Method not allowed");
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}
