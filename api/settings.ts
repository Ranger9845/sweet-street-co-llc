import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

// Shop schedule in Chicago time. Index = day-of-week (0=Sun).
type DaySchedule = { open: number; close: number } | null;
const SCHEDULE: DaySchedule[] = [
  null,                    // Sun: closed (restock day)
  { open: 7, close: 19 }, // Mon  7 AM – 7 PM
  { open: 7, close: 19 }, // Tue
  { open: 7, close: 19 }, // Wed
  { open: 7, close: 19 }, // Thu
  { open: 7, close: 20 }, // Fri  7 AM – 8 PM
  { open: 8, close: 20 }, // Sat  8 AM – 8 PM
];
const HOURS_DISPLAY = [
  "Closed",
  "7:00 AM – 7:00 PM",
  "7:00 AM – 7:00 PM",
  "7:00 AM – 7:00 PM",
  "7:00 AM – 7:00 PM",
  "7:00 AM – 8:00 PM",
  "8:00 AM – 8:00 PM",
];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getCtParts(at?: Date): { hour: number; minute: number; dow: number } {
  const now = at ?? new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: get("hour") % 24,
    minute: get("minute"),
    dow: dowMap[parts.find(p => p.type === "weekday")!.value] ?? 0,
  };
}

function computeScheduleFields(manualOpen: boolean, at?: Date) {
  const { hour, minute, dow } = getCtParts(at);
  const isSunday = dow === 0;
  const todaySchedule = SCHEDULE[dow];
  const todayHours = todaySchedule ? HOURS_DISPLAY[dow] : undefined;

  const currentMins = hour * 60 + minute;
  const withinHours = todaySchedule !== null
    && currentMins >= todaySchedule.open * 60
    && currentMins < todaySchedule.close * 60;

  const isOpen = manualOpen && withinHours;

  let minutesUntilClose: number | undefined;
  let closingSoon = false;
  if (withinHours && todaySchedule) {
    minutesUntilClose = todaySchedule.close * 60 - currentMins;
    closingSoon = minutesUntilClose <= 30;
  }

  let nextOpenLabel: string | undefined;
  if (!isOpen) {
    const fmtHour = (h: number) =>
      h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
    if (todaySchedule && currentMins < todaySchedule.open * 60) {
      nextOpenLabel = `today at ${fmtHour(todaySchedule.open)}`;
    } else {
      for (let d = 1; d <= 7; d++) {
        const nextDow = (dow + d) % 7;
        const s = SCHEDULE[nextDow];
        if (s) {
          const dayName = d === 1 ? "tomorrow" : DAY_LABELS[nextDow];
          nextOpenLabel = `${dayName} at ${fmtHour(s.open)}`;
          break;
        }
      }
    }
  }

  return { isSunday, isOpen, todayHours, closingSoon, minutesUntilClose, nextOpenLabel };
}

// Map DB snake_case → app camelCase
function toClient(row: Record<string, unknown>, includeSecret = false) {
  return {
    id: row.id,
    shopName: row.shop_name,
    siteDescription: row.site_description,
    readyMessage: row.ready_message,
    // ownerPassword is only included when the caller already proved ownership (PATCH)
    ...(includeSecret ? { ownerPassword: row.owner_password } : {}),
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
        isOpen: false, ownerPassword: process.env.OWNER_PASSWORD ?? "owner123",
        shopName: "Sweet Street Co.", siteDescription: "", readyMessage: "Your order is ready!",
        announcementEnabled: true,
        announcementText: "Our website will be temporarily unavailable for the next couple of days as we transition to a new service provider to ensure a more reliable and seamless experience. The current provider has experienced frequent outages, and we are taking this step to maintain a higher standard of professionalism and performance. During this migration, the site will remain online but non-responsive until the transition is complete. Thank you for your patience as we work to improve your experience.",
        happyHourEnabled: false, happyHourStart: "15:00", happyHourEnd: "17:00",
        happyHourDiscountType: "percent", happyHourDiscountValue: "50",
      });
    }

    const client = toClient(data as Record<string, unknown>);

    // Dev mode can fast-forward/rewind "now" (settings.dev_clock_override) to
    // preview schedule-based behavior without waiting for real time to pass.
    const overrideRaw = data.dev_clock_override as string | null | undefined;
    const clockOverride = overrideRaw ? new Date(overrideRaw) : undefined;
    const now = clockOverride ?? new Date();

    const hour = now.getHours() + now.getMinutes() / 60;
    const start = parseTime((data.happy_hour_start as string) ?? "15:00");
    const end = parseTime((data.happy_hour_end as string) ?? "17:00");
    const isHappyHour = !!(data.happy_hour_enabled && hour >= start && hour < end);

    const { isSunday, isOpen, todayHours, closingSoon, minutesUntilClose, nextOpenLabel } =
      computeScheduleFields(!!data.is_open, clockOverride);

    return res.json({
      ...client,
      isHappyHour,
      isOpen,
      manualOpen: !!data.is_open,
      isSunday,
      todayHours,
      closingSoon,
      minutesUntilClose,
      nextOpenLabel,
    });
  }

  if (req.method === "PATCH") {
    const isOwner = await requireOwner(req);
    if (!isOwner) return err(res, 403, "Forbidden");

    const raw = req.body?.data ?? req.body;
    const { id: _id, ...rest } = raw;
    const fields = toDb(rest);

    const { data, error } = await sb.from("settings").update(fields).eq("id", 1).select().single();
    if (error) return err(res, 400, error.message);
    return res.json(toClient(data as Record<string, unknown>, true));
  }

  return err(res, 405, "Method not allowed");
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}
