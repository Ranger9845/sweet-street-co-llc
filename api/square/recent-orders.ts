import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token || !locationId) {
    return res.status(200).json({ orders: [] });
  }

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    // Today at midnight UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const body = {
      location_ids: [locationId],
      query: {
        filter: {
          state_filter: { states: ["COMPLETED"] },
          date_time_filter: {
            created_at: { start_at: todayStart.toISOString() },
          },
        },
        sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
      },
      limit: 50,
    };

    const response = await fetch(`${baseUrl}/v2/orders/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      orders?: unknown[];
      errors?: { detail: string }[];
    };

    if (!response.ok || data.errors) {
      console.error("[square/recent-orders] Square error:", data.errors);
      return res.status(200).json({ orders: [] });
    }

    return res.status(200).json({ orders: data.orders ?? [] });
  } catch (e) {
    console.error("[square/recent-orders]", e);
    return err(res, 500, "Failed to fetch recent orders");
  }
}
