import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, err } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = req.body ?? {};
  // Store feedback as a review with auto-approved=false
  const { data, error } = await supabase()
    .from("reviews")
    .insert({
      reviewer_name: body.name ?? "Anonymous",
      rating: body.rating ?? 5,
      comment: body.comment ?? body.message ?? "",
      approved: "pending",
    })
    .select()
    .single();

  if (error) return err(res, 400, error.message);
  return res.status(201).json(data);
}
