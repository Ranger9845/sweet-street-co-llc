import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Direct Supabase client (set once from main.tsx) ───────────────────────
let _sb: SupabaseClient | null = null;

/** Call once at app startup (before rendering) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. */
export function initSupabase(url: string, anonKey: string) {
  _sb = createClient(url, anonKey);
}

function sb(): SupabaseClient {
  if (!_sb) throw new Error("initSupabase() has not been called");
  return _sb;
}

// ── Shared snake_case → camelCase mappers ─────────────────────────────────
function menuItemToClient(row: Record<string, unknown>): MenuItem {
  return {
    ...row,
    sizePrices: row.size_prices,
    sizePrepSteps: row.size_prep_steps,
    sizeIngredients: row.size_ingredients,
    modifierIds: row.modifier_ids,
    posCategoryId: row.pos_category_id,
    posSortOrder: row.pos_sort_order,
    posHidden: row.pos_hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as MenuItem;
}

function posCategoryToClient(row: Record<string, unknown>): PosCategory {
  return {
    ...row,
    sortOrder: row.sort_order,
    backgroundColor: row.background_color,
  } as PosCategory;
}

function rewardToClient(row: Record<string, unknown>) {
  return {
    ...row,
    pointsCost: row.points_cost,
    discountType: row.discount_type,
    discountValue: row.discount_value,
  };
}

export type MenuItem = {
  id: number;
  name: string;
  price?: number;
  sizePrices?: Record<string, number>;
  description?: string;
  available?: boolean;
  temperature?: "hot" | "cold" | "both";
  modifierIds?: number[];
  modifiers?: Array<{ id: number; name: string; price: number }>;
  ingredients?: Array<{ name: string; amount: string }>;
  sizeIngredients?: Record<string, Array<{ name: string; amount: string }>>;
  sizePrepSteps?: Record<string, Array<{ stepNumber: number; instruction: string }>>;
  posCategoryId?: string | null;
  posSortOrder?: number;
  posHidden?: boolean;
  color?: string;
  [key: string]: unknown;
};

export type PosCategory = {
  id: number;
  name: string;
  available?: boolean;
  items?: MenuItem[];
  sortOrder?: number;
  color?: string;
  backgroundColor?: string;
  emoji?: string;
  [key: string]: unknown;
};

export type OrderItem = {
  menuItemId?: number;
  menuItemName?: string;
  size?: string;
  temperature?: string | null;
  quantity?: number;
  unitPrice?: number;
  specialInstructions?: string | null;
  modifiers?: Array<{ id: number; name: string; price: number }>;
  lotusBase?: string | null;
  milk?: string | null;
  [key: string]: unknown;
};

export type OrderStats = {
  pendingCount: number;
  preparingCount: number;
  readyCount?: number;
  totalToday?: number;
  revenueToday?: number;
  [key: string]: unknown;
};

export type Settings = {
  id?: number;
  isOpen?: boolean;
  isSunday?: boolean;
  manualOpen?: boolean;
  openMode?: string;
  shopName?: string;
  siteDescription?: string;
  readyMessage?: string;
  ownerPassword?: string;
  announcementEnabled?: boolean;
  announcementText?: string;
  happyHourEnabled?: boolean;
  happyHourStart?: string;
  happyHourEnd?: string;
  happyHourDiscountType?: string;
  happyHourDiscountValue?: number | string;
  isHappyHour?: boolean;
  minutesUntilHappyHourEnd?: number | null;
  todayHours?: string;
  nextOpenLabel?: string;
  closingSoon?: boolean;
  minutesUntilClose?: number;
  posAccentColor?: string;
  posBgColor?: string;
  posCardColor?: string;
  posForegroundColor?: string;
  posMutedColor?: string;
  posBorderColor?: string;
  posHeaderText?: string;
  posButtonRadius?: string;
  devNotificationEnabled?: boolean;
  devNotificationTitle?: string;
  devNotificationBody?: string;
  devNotificationMaxShows?: number;
  devNotificationVersion?: string;
  devNotificationCtaLabel?: string;
  devNotificationCtaUrl?: string;
  [key: string]: unknown;
};

export type Order = {
  id: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  customerSmsConsent?: boolean;
  notes?: string | null;
  discountCode?: string | null;
  discountAmount?: number;
  totalAmount?: number;
  status?: string;
  source?: string;
  clerkUserId?: string | null;
  scheduledFor?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: OrderItem[];
  [key: string]: unknown;
};

let extraHeaders: Record<string, string> = {};

export function setExtraHeaders(headers: Record<string, string> = {}) {
  extraHeaders = { ...headers };
}

function buildQueryString(params?: Record<string, unknown>) {
  if (!params) return "";
  const pairs = Object.entries(params).reduce<string[]>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    return acc;
  }, []);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...(init.headers as Record<string, string> | undefined),
    },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  }

  return (await res.json()) as T;
}

const queryKey = (name: string, params?: Record<string, unknown>) => [name, params] as const;

// Optional extra query options accepted by hooks (passed as second arg `{ query: {...} }`)
type QueryOverrides = {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
  staleTime?: number;
  queryKey?: readonly unknown[];
  [key: string]: unknown;
};
type HookOptions = { query?: QueryOverrides };

export const getListMenuItemsQueryKey = (params?: Record<string, unknown>) => queryKey("listMenuItems", params);
export const getListOrdersQueryKey = (params?: Record<string, unknown>) => queryKey("listOrders", params);
export const getListPosCategoriesQueryKey = (params?: Record<string, unknown>) => queryKey("listPosCategories", params);
export const getGetOrderQueryKey = (id?: number | string) => queryKey("getOrder", { id });
export const getGetOrderStatsQueryKey = () => queryKey("getOrderStats");
export const getGetSettingsQueryKey = () => queryKey("getSettings");

export function useListMenuItems(params?: Record<string, unknown>, options?: HookOptions) {
  return useQuery({
    queryKey: getListMenuItemsQueryKey(params),
    queryFn: async () => {
      const { data, error } = await sb().from("menu_items").select("*").order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => menuItemToClient(r as Record<string, unknown>));
    },
    ...options?.query,
  });
}

export function useListModifiers() {
  return useQuery({
    queryKey: ["listModifiers"],
    queryFn: async () => {
      const { data, error } = await sb().from("modifiers").select("*").order("id");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ id: number; name: string; price: number; available?: boolean }>;
    },
  });
}

export function useGetSettings(options?: HookOptions) {
  return useQuery({
    queryKey: getGetSettingsQueryKey(),
    queryFn: () => fetchJson<Settings>("/api/settings"),
    ...options?.query,
  });
}

export function useGetOrderStats(options?: HookOptions) {
  return useQuery({
    queryKey: getGetOrderStatsQueryKey(),
    queryFn: () => fetchJson<OrderStats>("/api/orders/stats"),
    ...options?.query,
  });
}

export function useListOrders(params?: Record<string, unknown>, options?: HookOptions) {
  return useQuery({
    queryKey: getListOrdersQueryKey(params),
    queryFn: () => fetchJson<Order[]>(`/api/orders${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function useGetOrder(id: number | string | undefined, options?: HookOptions) {
  return useQuery({
    queryKey: getGetOrderQueryKey(id),
    queryFn: () => fetchJson<Order>(`/api/orders/${id}`),
    enabled: id !== undefined && id !== null,
    ...options?.query,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson<Order>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useCreateMenuItem() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson<MenuItem>("/api/menu-items", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useUpdateMenuItem() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson<MenuItem>(`/api/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useDeleteMenuItem() {
  return useMutation({
    mutationFn: (id: number | string) => fetchJson(`/api/menu-items/${id}`, { method: "DELETE" }),
  });
}

export function useCreatePosCategory() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson<PosCategory>("/api/pos/categories", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useUpdatePosCategory() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson<PosCategory>(`/api/pos/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useDeletePosCategory() {
  return useMutation({
    mutationFn: (id: number | string) => fetchJson(`/api/pos/categories/${id}`, { method: "DELETE" }),
  });
}

export function useUpdatePosItemAssignments() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson("/api/pos-item-assignments", { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useBumpOrder() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson(`/api/orders/${id}/bump`, { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useListPosCategories(options?: HookOptions) {
  return useQuery({
    queryKey: getListPosCategoriesQueryKey(),
    queryFn: async () => {
      const { data, error } = await sb().from("pos_categories").select("*").order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => posCategoryToClient(r as Record<string, unknown>));
    },
    ...options?.query,
  });
}

export function useListRewards(options?: HookOptions) {
  return useQuery({
    queryKey: ["listRewards"],
    queryFn: async () => {
      const { data, error } = await sb().from("rewards").select("*").eq("active", true).order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => rewardToClient(r as Record<string, unknown>));
    },
    ...options?.query,
  });
}

export function useGetPointsBalance(clerkUserId: string | undefined, options?: HookOptions) {
  return useQuery({
    queryKey: ["pointsBalance", clerkUserId],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("points_ledger")
        .select("points, type, description, created_at, id")
        .eq("clerk_user_id", clerkUserId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const balance = rows.reduce((sum, r) => sum + (r.points ?? 0), 0);
      return {
        balance,
        userId: clerkUserId,
        history: rows.map((r) => ({
          id: r.id,
          points: r.points,
          type: r.type,
          description: r.description,
          createdAt: r.created_at,
        })),
      };
    },
    enabled: !!clerkUserId,
    ...options?.query,
  });
}
