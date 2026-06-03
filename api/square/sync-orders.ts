import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token || !locationId) return res.status(200).json({ imported: 0 });

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const searchRes = await fetch(`${baseUrl}/v2/orders/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location_ids: [locationId],
        query: {
          filter: {
            state_filter: { states: ["COMPLETED"] },
            date_time_filter: { created_at: { start_at: todayStart.toISOString() } },
          },
          sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
        },
        limit: 50,
      }),
    });

    const data = (await searchRes.json()) as { orders?: any[]; errors?: any[] };
    if (!searchRes.ok || data.errors) return res.status(200).json({ imported: 0 });

    const squareOrders = data.orders ?? [];
    if (squareOrders.length === 0) return res.status(200).json({ imported: 0 });

    const sb = supabase();
    const squareIds = squareOrders.map((o: any) => o.id as string);

    const { data: existing } = await sb
      .from("orders")
      .select("square_order_id")
      .in("square_order_id", squareIds);

    const alreadyImported = new Set((existing ?? []).map((o: any) => o.square_order_id));
    const toSync = squareOrders.filter((o: any) => !alreadyImported.has(o.id));

    if (toSync.length === 0) return res.status(200).json({ imported: 0 });

    const rows = toSync.map((o: any) => ({
      customer_name: "Square POS",
      status: "pending",
      source: "square-pos",
      square_order_id: o.id as string,
      total_amount: (o.total_money?.amount ?? 0) / 100,
      paid_at: new Date().toISOString(),
      items: (o.line_items ?? []).map((item: any) => ({
        menuItemId: null,
        menuItemName: item.name as string,
        quantity: parseInt(item.quantity ?? "1", 10),
        size: (item.variation_name as string) || null,
        unitPrice: (item.base_price_money?.amount ?? 0) / 100,
      })),
      created_at: o.created_at as string,
    }));

    const { error } = await sb.from("orders").insert(rows);
    if (error) {
      console.error("[square/sync-orders] insert error:", error.message);
      return res.status(200).json({ imported: 0, error: error.message });
    }

    return res.status(200).json({ imported: toSync.length });
  } catch (e) {
    console.error("[square/sync-orders]", e);
    return err(res, 500, "Failed to sync Square orders");
  }
}
