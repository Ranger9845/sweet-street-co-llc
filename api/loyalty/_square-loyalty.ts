/**
 * Shared helpers for Square Loyalty API calls.
 * All functions are async and throw on Square API errors.
 */

// Module-level cache for the loyalty program ID (fetched once per process)
let cachedProgramId: string | null = null;

export function getSquareBaseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

/**
 * Normalizes a US phone number to E.164 format (+1XXXXXXXXXX).
 * Returns null if the number cannot be normalized.
 */
export function normalizePhone(raw: string): string | null {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Already in E.164 form
  if (raw.startsWith("+") && digits.length >= 11) {
    return `+${digits}`;
  }
  return null;
}

export type SquareLoyaltyAccount = {
  id: string;
  balance: number;
  lifetime_points: number;
  mapping?: { type: string; value: string };
};

/**
 * Fetches and caches the loyalty program ID from Square.
 * Square accounts have exactly one loyalty program.
 */
export async function getLoyaltyProgramId(
  baseUrl: string,
  token: string,
): Promise<string> {
  if (cachedProgramId) return cachedProgramId;

  const { default: fetch } = await import("node-fetch");
  const res = await fetch(`${baseUrl}/v2/loyalty/programs`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json()) as {
    programs?: { id: string }[];
    errors?: { detail: string }[];
  };

  if (!res.ok || data.errors) {
    throw new Error(data.errors?.[0]?.detail ?? "Failed to fetch loyalty programs");
  }

  const programId = data.programs?.[0]?.id;
  if (!programId) throw new Error("No loyalty program found in Square account");

  cachedProgramId = programId;
  return programId;
}

/**
 * Searches for an existing loyalty account by phone number.
 * Returns the account or null if not found.
 */
export async function searchLoyaltyAccount(
  baseUrl: string,
  token: string,
  phone: string,
): Promise<SquareLoyaltyAccount | null> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: {
        mappings: [{ type: "PHONE", value: phone }],
      },
    }),
  });

  const data = (await res.json()) as {
    loyalty_accounts?: SquareLoyaltyAccount[];
    errors?: { detail: string }[];
  };

  if (!res.ok || data.errors) {
    throw new Error(data.errors?.[0]?.detail ?? "Failed to search loyalty accounts");
  }

  return data.loyalty_accounts?.[0] ?? null;
}

/**
 * Creates a new loyalty account for the given phone number.
 */
export async function createLoyaltyAccount(
  baseUrl: string,
  token: string,
  phone: string,
): Promise<SquareLoyaltyAccount | null> {
  const programId = await getLoyaltyProgramId(baseUrl, token);

  const { default: fetch } = await import("node-fetch");
  const res = await fetch(`${baseUrl}/v2/loyalty/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      idempotency_key: `create-${phone}-${Date.now()}`,
      loyalty_account: {
        program_id: programId,
        mapping: { type: "PHONE", value: phone },
      },
    }),
  });

  const data = (await res.json()) as {
    loyalty_account?: SquareLoyaltyAccount;
    errors?: { detail: string }[];
  };

  if (!res.ok || data.errors) {
    throw new Error(data.errors?.[0]?.detail ?? "Failed to create loyalty account");
  }

  return data.loyalty_account ?? null;
}

/**
 * Accumulates loyalty points for an order.
 * Returns the updated loyalty account.
 */
export async function accumulateLoyaltyPoints(
  baseUrl: string,
  token: string,
  accountId: string,
  orderId: string,
): Promise<SquareLoyaltyAccount | null> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error("SQUARE_LOCATION_ID not configured");

  const { default: fetch } = await import("node-fetch");
  const res = await fetch(`${baseUrl}/v2/loyalty/events/accumulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      idempotency_key: `accumulate-${accountId}-${orderId}`,
      accumulate_points: { order_id: orderId },
      loyalty_account_id: accountId,
      location_id: locationId,
    }),
  });

  const data = (await res.json()) as {
    event?: { accumulate_points?: { points: number }; loyalty_account_id?: string };
    errors?: { detail: string }[];
  };

  if (!res.ok || data.errors) {
    throw new Error(data.errors?.[0]?.detail ?? "Failed to accumulate loyalty points");
  }

  // Fetch the updated account balance after accumulation
  const updatedRes = await fetch(`${baseUrl}/v2/loyalty/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const updatedData = (await updatedRes.json()) as {
    loyalty_account?: SquareLoyaltyAccount;
  };

  return updatedData.loyalty_account ?? null;
}
