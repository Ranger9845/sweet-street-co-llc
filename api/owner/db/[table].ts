import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, setCors, requireOwner, err } from "../../_utils";

interface TableConfig {
  primaryKey: string[];
  hidden?: string[];
  allowInsert?: boolean;
  allowDelete?: boolean;
}

const TABLE_CONFIG: Record<string, TableConfig> = {
  settings: { primaryKey: ["id"], hidden: ["owner_password"], allowInsert: false, allowDelete: false },
  menu_items: { primaryKey: ["id"] },
  modifiers: { primaryKey: ["id"] },
  pos_categories: { primaryKey: ["id"] },
  orders: { primaryKey: ["id"] },
  discount_codes: { primaryKey: ["id"] },
  rewards: { primaryKey: ["id"] },
  points_ledger: { primaryKey: ["id"] },
  favorites: { primaryKey: ["clerk_user_id", "menu_item_id"] },
  reviews: { primaryKey: ["id"] },
  live_carts: { primaryKey: ["device_id"] },
  user_profiles: { primaryKey: ["clerk_user_id"] },
  user_seen_points: { primaryKey: ["clerk_user_id"] },
  inventory_receives: { primaryKey: ["id"] },
  inventory_costs: { primaryKey: ["variation_id"] },
  gift_cards: { primaryKey: ["id"], hidden: ["gan"] },
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

function clean(row: Record<string, unknown>, hidden: string[]) {
  if (!hidden.length) return row;
  const out = { ...row };
  for (const h of hidden) delete out[h];
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const isOwner = await requireOwner(req);
  if (!isOwner) return err(res, 403, "Forbidden");

  const table = req.query.table as string;
  const config = TABLE_CONFIG[table];
  if (!config) return err(res, 404, "Unknown table");

  const sb = supabase();
  const hidden = config.hidden ?? [];

  if (req.method === "GET") {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const sortCol = (req.query.sort as string) || config.primaryKey[0];
    const ascending = req.query.order === "asc";

    const { data, error, count } = await sb
      .from(table)
      .select("*", { count: "exact" })
      .order(sortCol, { ascending })
      .range(from, to);

    if (error) return err(res, 400, error.message);

    let columns = (data ?? [])[0] ? Object.keys(data[0] as Record<string, unknown>) : [];
    if (!columns.length) {
      const sample = await sb.from(table).select("*").limit(1).maybeSingle();
      if (sample.data) columns = Object.keys(sample.data as Record<string, unknown>);
    }
    columns = columns.filter((c) => !hidden.includes(c));

    return res.json({
      rows: (data ?? []).map((r) => clean(r as Record<string, unknown>, hidden)),
      total: count ?? 0,
      page,
      pageSize,
      columns,
      primaryKey: config.primaryKey,
      hidden,
      allowInsert: config.allowInsert !== false,
      allowDelete: config.allowDelete !== false,
    });
  }

  if (req.method === "POST") {
    if (config.allowInsert === false) return err(res, 400, "Inserting rows into this table is not allowed");
    const body: Record<string, unknown> = { ...(req.body ?? {}) };
    for (const h of hidden) delete body[h];
    const { data, error } = await sb.from(table).insert(body).select().single();
    if (error) return err(res, 400, error.message);
    return res.status(201).json(clean(data as Record<string, unknown>, hidden));
  }

  if (req.method === "PATCH") {
    const { match, fields } = (req.body ?? {}) as { match?: Record<string, unknown>; fields?: Record<string, unknown> };
    if (!match || typeof match !== "object") return err(res, 400, "match is required");
    for (const pk of config.primaryKey) {
      if (match[pk] === undefined) return err(res, 400, `match.${pk} is required`);
    }

    const updateFields: Record<string, unknown> = { ...(fields ?? {}) };
    for (const h of hidden) delete updateFields[h];
    for (const pk of config.primaryKey) delete updateFields[pk];
    if (Object.keys(updateFields).length === 0) return err(res, 400, "No fields to update");

    let query = sb.from(table).update(updateFields);
    for (const pk of config.primaryKey) query = query.eq(pk, match[pk] as string | number);
    const { data, error } = await query.select().single();
    if (error) return err(res, 400, error.message);
    return res.json(clean(data as Record<string, unknown>, hidden));
  }

  if (req.method === "DELETE") {
    if (config.allowDelete === false) return err(res, 400, "Deleting rows from this table is not allowed");
    const match = (req.body?.match ?? {}) as Record<string, unknown>;
    for (const pk of config.primaryKey) {
      if (match[pk] === undefined) return err(res, 400, `match.${pk} is required`);
    }

    let query = sb.from(table).delete();
    for (const pk of config.primaryKey) query = query.eq(pk, match[pk] as string | number);
    const { error } = await query;
    if (error) return err(res, 400, error.message);
    return res.status(204).end();
  }

  return err(res, 405, "Method not allowed");
}
