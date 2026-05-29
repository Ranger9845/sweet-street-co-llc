import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = supabase();

  if (req.method === "GET") {
    const isOwner = await requireOwner(req);
    if (!isOwner) return err(res, 403, "Forbidden");

    // Remove stale carts (older than 10 minutes)
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await sb.from("live_carts").delete().lt("updated_at", cutoff);

    const { data, error } = await sb
      .from("live_carts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return err(res, 500, error.message);

    const carts = (data ?? []).map((c) => ({
      deviceId: c.device_id,
      customerName: c.customer_name,
      items: c.items,
      subtotal: Number(c.subtotal),
      updatedAt: new Date(c.updated_at).getTime(),
    }));

    return res.json({ carts });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const { device_id, customer_name, items, subtotal } = body;
    if (!device_id) return err(res, 400, "device_id required");

    const { error } = await sb.from("live_carts").upsert({
      device_id,
      customer_name: customer_name ?? "Guest",
      items: items ?? [],
      subtotal: subtotal ?? 0,
      updated_at: new Date().toISOString(),
    });
    if (error) return err(res, 400, error.message);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { device_id } = req.body ?? {};
    if (!device_id) return err(res, 400, "device_id required");
    await sb.from("live_carts").delete().eq("device_id", device_id);
    return res.json({ ok: true });
  }

  return err(res, 405, "Method not allowed");
}
