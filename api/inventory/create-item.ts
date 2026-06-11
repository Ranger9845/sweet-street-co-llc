import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err, requireOwner } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");
  if (!(await requireOwner(req))) return err(res, 401, "Unauthorized");

  const body = req.body ?? {};
  const itemName = (body.itemName as string | undefined)?.trim();
  const variationName = (body.variationName as string | undefined)?.trim() || "Regular";
  const sku = (body.sku as string | undefined)?.trim() || undefined;
  const price = Number(body.price);

  if (!itemName || !Number.isFinite(price) || price < 0) {
    return err(res, 400, "itemName and a non-negative price are required");
  }

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return err(res, 400, "Square is not configured");

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    const createRes = await fetch(`${baseUrl}/v2/catalog/object`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        idempotency_key: `create-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        object: {
          type: "ITEM",
          id: "#new-item",
          item_data: {
            name: itemName,
            variations: [
              {
                type: "ITEM_VARIATION",
                id: "#new-variation",
                item_variation_data: {
                  item_id: "#new-item",
                  name: variationName,
                  sku,
                  pricing_type: "FIXED_PRICING",
                  price_money: { amount: Math.round(price * 100), currency: "USD" },
                },
              },
            ],
          },
        },
      }),
    });

    const data = (await createRes.json()) as any;
    if (!createRes.ok || data.errors) {
      return err(res, 400, data.errors?.[0]?.detail ?? "Failed to create item in Square");
    }

    const itemObj = data.catalog_object;
    const variationObj = itemObj?.item_data?.variations?.[0];

    return res.status(201).json({
      result: {
        variationId: variationObj?.id,
        itemId: itemObj?.id ?? null,
        itemName: itemObj?.item_data?.name ?? itemName,
        variationName: variationObj?.item_variation_data?.name ?? variationName,
        sku: variationObj?.item_variation_data?.sku ?? null,
        upc: variationObj?.item_variation_data?.upc ?? null,
        price: (variationObj?.item_variation_data?.price_money?.amount ?? 0) / 100,
        count: 0,
        unitCost: null,
      },
    });
  } catch (e: any) {
    console.error("[inventory/create-item]", e);
    return err(res, 500, e.message);
  }
}
