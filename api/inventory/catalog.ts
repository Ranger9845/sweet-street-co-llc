import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await requireOwner(req))) return err(res, 401, "Unauthorized");

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token || !locationId) return res.json({ items: [], configured: false });

  try {
    const { default: fetch } = await import("node-fetch");
    const baseUrl = getSquareBaseUrl();

    // Paginate through all catalog items
    const allObjects: any[] = [];
    let cursor: string | undefined;
    do {
      const url = `${baseUrl}/v2/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ""}`;
      const catRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const catData = (await catRes.json()) as any;
      allObjects.push(...(catData.objects ?? []));
      cursor = catData.cursor;
    } while (cursor);

    const items = allObjects
      .filter((o: any) => o.type === "ITEM")
      .map((o: any) => ({
        id: o.id,
        name: o.item_data?.name ?? "",
        variations: (o.item_data?.variations ?? []).map((v: any) => ({
          id: v.id,
          name: v.item_variation_data?.name ?? "Regular",
          sku: v.item_variation_data?.sku ?? null,
          upc: v.item_variation_data?.upc ?? null,
          price: (v.item_variation_data?.price_money?.amount ?? 0) / 100,
        })),
      }));

    // Batch-retrieve inventory counts
    const variationIds = items.flatMap((i: any) => i.variations.map((v: any) => v.id));
    const countsMap: Record<string, number> = {};
    if (variationIds.length > 0) {
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

    // Merge stored unit costs from Supabase
    const sb = supabase();
    const { data: costs } = await sb.from("inventory_costs").select("*");
    const costsMap: Record<string, any> = {};
    for (const c of costs ?? []) costsMap[c.variation_id] = c;

    const enriched = items.map((item: any) => ({
      ...item,
      variations: item.variations.map((v: any) => ({
        ...v,
        count: countsMap[v.id] ?? null,
        unitCost: costsMap[v.id]?.unit_cost ?? null,
      })),
    }));

    return res.json({ items: enriched, configured: true });
  } catch (e: any) {
    console.error("[inventory/catalog]", e);
    return err(res, 500, e.message);
  }
}
