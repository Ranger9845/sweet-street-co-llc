import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await requireOwner(req))) return err(res, 401, "Unauthorized");

  const q = (req.query.q as string)?.trim();
  if (!q) return err(res, 400, "q is required");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token) return res.json({ results: [] });

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    // Search variations by text — matches name, SKU, UPC, description
    const searchRes = await fetch(`${baseUrl}/v2/catalog/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        object_types: ["ITEM_VARIATION"],
        query: { text_query: { keywords: [q] } },
        limit: 20,
      }),
    });
    const searchData = (await searchRes.json()) as any;
    const variationObjects: any[] = searchData.objects ?? [];

    if (variationObjects.length === 0) return res.json({ results: [] });

    // Fetch parent item names
    const itemIds = [...new Set(variationObjects.map((v: any) => v.item_variation_data?.item_id).filter(Boolean))];
    const itemNames: Record<string, string> = {};
    if (itemIds.length > 0) {
      const itemRes = await fetch(`${baseUrl}/v2/catalog/batch-retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ object_ids: itemIds }),
      });
      const itemData = (await itemRes.json()) as any;
      for (const o of itemData.objects ?? []) itemNames[o.id] = o.item_data?.name ?? "";
    }

    // Batch-retrieve inventory counts
    const variationIds = variationObjects.map((v: any) => v.id);
    const countsMap: Record<string, number> = {};
    if (locationId && variationIds.length > 0) {
      const countRes = await fetch(`${baseUrl}/v2/inventory/counts/batch-retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ catalog_object_ids: variationIds, location_ids: [locationId] }),
      });
      const countData = (await countRes.json()) as any;
      for (const c of countData.counts ?? []) {
        if (c.state === "IN_STOCK") countsMap[c.catalog_object_id] = Number(c.quantity ?? 0);
      }
    }

    // Merge stored unit costs
    const sb = supabase();
    const { data: costs } = await sb.from("inventory_costs").select("*").in("variation_id", variationIds);
    const costsMap: Record<string, number> = {};
    for (const c of costs ?? []) costsMap[c.variation_id] = Number(c.unit_cost);

    const results = variationObjects.map((v: any) => ({
      variationId: v.id,
      itemId: v.item_variation_data?.item_id ?? null,
      itemName: itemNames[v.item_variation_data?.item_id ?? ""] ?? "",
      variationName: v.item_variation_data?.name ?? "Regular",
      sku: v.item_variation_data?.sku ?? null,
      upc: v.item_variation_data?.upc ?? null,
      price: (v.item_variation_data?.price_money?.amount ?? 0) / 100,
      count: countsMap[v.id] ?? null,
      unitCost: costsMap[v.id] ?? null,
    }));

    return res.json({ results });
  } catch (e: any) {
    console.error("[inventory/search]", e);
    return err(res, 500, e.message);
  }
}
