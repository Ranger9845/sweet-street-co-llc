import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err, requireOwner } from "../_utils.js";
import { getSquareBaseUrl } from "../loyalty/_square-loyalty.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");
  if (!(await requireOwner(req))) return err(res, 401, "Unauthorized");

  const body = req.body ?? {};
  const { variationId, itemName, variationName, quantity, unitCost, notes } = body;

  if (!variationId || !quantity || Number(quantity) <= 0) {
    return err(res, 400, "variationId and a positive quantity are required");
  }

  const sb = supabase();

  // Log receive in Supabase
  const { error: insertErr } = await sb.from("inventory_receives").insert({
    variation_id: variationId,
    item_name: itemName ?? null,
    variation_name: variationName ?? null,
    quantity: Number(quantity),
    unit_cost: Number(unitCost ?? 0),
    notes: notes ?? null,
  });
  if (insertErr) return err(res, 500, insertErr.message);

  // Upsert the unit cost so it's remembered for next time
  if (unitCost && Number(unitCost) > 0) {
    await sb.from("inventory_costs").upsert(
      {
        variation_id: variationId,
        item_name: itemName ?? null,
        variation_name: variationName ?? null,
        unit_cost: Number(unitCost),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "variation_id" },
    );
  }

  // Push RECEIVE change to Square inventory (best-effort)
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (token && locationId) {
    try {
      const { default: fetch } = await import("node-fetch");
      const baseUrl = getSquareBaseUrl();
      const pushRes = await fetch(`${baseUrl}/v2/inventory/changes/batch-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          idempotency_key: `receive-${variationId}-${Date.now()}`,
          changes: [
            {
              type: "RECEIVE",
              receive: {
                catalog_object_id: variationId,
                quantity: String(Number(quantity)),
                state: "IN_STOCK",
                location_id: locationId,
                occurred_at: new Date().toISOString(),
              },
            },
          ],
        }),
      });
      if (!pushRes.ok) {
        const d = (await pushRes.json()) as any;
        console.error("[inventory/receive] Square push error:", d.errors);
      }
    } catch (e) {
      console.error("[inventory/receive] Square push failed:", e);
    }
  }

  return res.status(201).json({ success: true });
}
