import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, orderToClient, err } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const { id } = req.query;
  const { data, error } = await supabase().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) return err(res, 500, error.message);
  if (!data) return err(res, 404, "Order not found");
  return res.json(orderToClient(data as Record<string, unknown>));
}
