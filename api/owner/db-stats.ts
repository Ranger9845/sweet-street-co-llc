import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils";

const TABLES = [
  "settings", "menu_items", "modifiers", "pos_categories", "orders",
  "discount_codes", "rewards", "points_ledger", "favorites", "reviews",
  "live_carts", "user_profiles", "user_seen_points", "inventory_receives",
  "inventory_costs", "gift_cards",
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const sb = supabase();

  const [
    tableCounts,
    ordersResult,
    menuAvailableResult,
    giftCardsResult,
    pointsResult,
    reviewsResult,
    activeDiscountCodesResult,
    activeRewardsResult,
    inventoryResult,
  ] = await Promise.all([
    Promise.all(TABLES.map(async (table) => {
      const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
      return { name: table, count: error ? null : (count ?? 0) };
    })),
    sb.from("orders").select("status, total_amount, created_at"),
    sb.from("menu_items").select("*", { count: "exact", head: true }).eq("available", true),
    sb.from("gift_cards").select("amount_cents"),
    sb.from("points_ledger").select("points"),
    sb.from("reviews").select("rating, approved"),
    sb.from("discount_codes").select("*", { count: "exact", head: true }).eq("active", true),
    sb.from("rewards").select("*", { count: "exact", head: true }).eq("active", true),
    sb.from("inventory_receives").select("quantity, unit_cost"),
  ]);

  const orders = ordersResult.data ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ordersByStatus: Record<string, number> = {};
  let revenue = 0;
  let revenueToday = 0;
  let ordersToday = 0;
  for (const o of orders) {
    const status = (o.status as string) ?? "unknown";
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
    if (status === "cancelled") continue;
    const amount = Number(o.total_amount) || 0;
    revenue += amount;
    if (o.created_at && new Date(o.created_at as string) >= todayStart) {
      revenueToday += amount;
      ordersToday += 1;
    }
  }

  const giftCardTotalCents = (giftCardsResult.data ?? [])
    .reduce((sum, g) => sum + (Number(g.amount_cents) || 0), 0);

  const pointsOutstanding = (pointsResult.data ?? [])
    .reduce((sum, p) => sum + (Number(p.points) || 0), 0);

  const reviews = reviewsResult.data ?? [];
  const approvedReviews = reviews.filter((r) => r.approved).length;
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0;

  const inventorySpend = (inventoryResult.data ?? [])
    .reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0);

  return res.json({
    tables: tableCounts,
    highlights: {
      orders: {
        total: orders.length,
        today: ordersToday,
        byStatus: ordersByStatus,
        revenue,
        revenueToday,
      },
      menuAvailable: menuAvailableResult.count ?? 0,
      giftCardTotalCents,
      pointsOutstanding,
      reviews: { total: reviews.length, approved: approvedReviews, avgRating },
      activeDiscountCodes: activeDiscountCodesResult.count ?? 0,
      activeRewards: activeRewardsResult.count ?? 0,
      inventorySpend,
    },
  });
}
