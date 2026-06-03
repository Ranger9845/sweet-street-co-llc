import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err } from "../../_utils.js";

const TAX_RATE = 0.0946;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  const { customerName = "Walk-in", items = [] } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return err(res, 400, "No items in order");
  }

  const sb = supabase();

  // Fetch menu items for price lookup when unitPrice wasn't supplied
  const menuItemIds = items.map((i: any) => i.menuItemId).filter(Boolean);
  const menuItemsMap = new Map<number, any>();
  if (menuItemIds.length > 0) {
    const { data } = await sb.from("menu_items").select("id,name,size_prices").in("id", menuItemIds);
    (data ?? []).forEach((m: any) => menuItemsMap.set(m.id, m));
  }

  const enrichedItems = items.map((item: any) => {
    const mi = menuItemsMap.get(item.menuItemId);
    let unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : null;
    if (unitPrice == null && mi) {
      const sp = (mi.size_prices ?? {}) as Record<string, number>;
      unitPrice = (item.size && sp[item.size]) ? sp[item.size] : (Object.values(sp)[0] as number ?? 0);
    }
    return {
      menuItemId: item.menuItemId ?? null,
      menuItemName: item.menuItemName ?? mi?.name ?? "Item",
      quantity: Number(item.quantity) || 1,
      size: item.size ?? null,
      unitPrice: unitPrice ?? 0,
      temperature: item.temperature ?? null,
      milk: item.milk ?? null,
      lotusBase: item.lotusBase ?? null,
      specialInstructions: item.specialInstructions ?? null,
    };
  });

  const subtotal = enrichedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const { data: order, error } = await sb.from("orders").insert({
    customer_name: customerName,
    status: "pending",
    source: "pos",
    total_amount: total,
    paid_at: new Date().toISOString(),
    items: enrichedItems,
  }).select().single();

  if (error) return err(res, 400, error.message);
  return res.status(201).json(orderToClient(order as Record<string, unknown>));
}
