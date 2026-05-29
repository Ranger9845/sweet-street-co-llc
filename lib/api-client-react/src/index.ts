import { useMutation, useQuery } from "@tanstack/react-query";

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
  [key: string]: unknown;
};

export type PosCategory = {
  id: number;
  name: string;
  available?: boolean;
  items?: MenuItem[];
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
  isOpen?: boolean;
  isSunday?: boolean;
  happyHourDiscountType?: string;
  happyHourDiscountValue?: number | string;
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

export const getListMenuItemsQueryKey = (params?: Record<string, unknown>) => queryKey("listMenuItems", params);
export const getListOrdersQueryKey = (params?: Record<string, unknown>) => queryKey("listOrders", params);
export const getListPosCategoriesQueryKey = (params?: Record<string, unknown>) => queryKey("listPosCategories", params);
export const getGetOrderQueryKey = (params: { id: number | string }) => queryKey("getOrder", params);
export const getGetOrderStatsQueryKey = () => queryKey("getOrderStats");
export const getGetSettingsQueryKey = () => queryKey("getSettings");

export function useListMenuItems(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: getListMenuItemsQueryKey(params),
    queryFn: () => fetchJson<MenuItem[]>(`/api/menu-items${buildQueryString(params)}`),
  });
}

export function useListModifiers() {
  return useQuery({
    queryKey: ["listModifiers"],
    queryFn: () => fetchJson<Array<{ id: number; name: string; price: number; available?: boolean }>>("/api/modifiers"),
  });
}

export function useGetSettings() {
  return useQuery({
    queryKey: getGetSettingsQueryKey(),
    queryFn: () => fetchJson<Settings>("/api/settings"),
  });
}

export function useGetOrderStats() {
  return useQuery({
    queryKey: getGetOrderStatsQueryKey(),
    queryFn: () => fetchJson<OrderStats>("/api/orders/stats"),
  });
}

export function useListOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: getListOrdersQueryKey(params),
    queryFn: () => fetchJson<any[]>(`/api/orders${buildQueryString(params)}`),
  });
}

export function useGetOrder(id: number | string | undefined) {
  return useQuery({
    queryKey: getGetOrderQueryKey({ id }),
    queryFn: () => fetchJson<any>(`/api/orders/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useCreateMenuItem() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson("/api/menu-items", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useUpdateMenuItem() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson(`/api/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useDeleteMenuItem() {
  return useMutation({
    mutationFn: (id: number | string) => fetchJson(`/api/menu-items/${id}`, { method: "DELETE" }),
  });
}

export function useCreatePosCategory() {
  return useMutation({
    mutationFn: (body: unknown) => fetchJson("/api/pos/categories", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useUpdatePosCategory() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number | string; [key: string]: unknown }) =>
      fetchJson(`/api/pos/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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
    mutationFn: (body: unknown) => fetchJson("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  });
}

export function useListPosCategories() {
  return useQuery({
    queryKey: getListPosCategoriesQueryKey(),
    queryFn: () => fetchJson<PosCategory[]>("/api/pos/categories"),
  });
}
