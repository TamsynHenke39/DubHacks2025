/* src/lib/payments.ts
   Minimal client for the isolated payments service (simulate-first).
   Configure base URL via VITE_PAYMENTS_BASE_URL; defaults to http://127.0.0.1:8001.
*/

const BASE = import.meta.env.VITE_PAYMENTS_BASE_URL ?? "http://127.0.0.1:8001";

// Types matching backend responses
export interface AccountCreateResponse {
  userId: number;
  accountId: number;
  currency: string;
  balanceCents: number;
}

export interface AccountResponse {
  userId: number;
  accountId: number;
  currency: string;
  balanceCents: number;
}

export interface TransferResponse {
  transferGroupId: string;
  fromBalanceCents: number;
  toBalanceCents: number;
}

export interface DepositResponse {
  transactionId: number;
  newBalanceCents: number;
}

export interface TransactionItem {
  id: number;
  accountId: number;
  type: string; // deposit | transfer_in | transfer_out | adjustment
  status: string; // posted | pending | failed
  amountCents: number;
  currency: string;
  transferGroupId?: string | null;
  relatedEntryId?: number | null;
  createdAt: string; // ISO
}

export interface TransactionsResponse {
  accountId: number;
  items: TransactionItem[];
}

// Small helper to throw on non-2xx
async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!res.ok) {
    // Try to surface JSON error detail if present
    try {
      const data = JSON.parse(text);
      const detail = typeof data?.detail === "string" ? data.detail : text;
      throw new Error(`${res.status} ${res.statusText}: ${detail}`);
    } catch {
      throw new Error(`${res.status} ${res.statusText}: ${text || "Request failed"}`);
    }
  }
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

// Idempotency-Key generator (simple, dependency-free)
export function makeIdempotencyKey(): string {
  // Prefer Web Crypto if available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback
  return "ik_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// API calls

export async function createAccount(email: string, name?: string): Promise<AccountCreateResponse> {
  return http<AccountCreateResponse>(`${BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
}

export async function getAccount(accountId: number): Promise<AccountResponse> {
  return http<AccountResponse>(`${BASE}/accounts/${accountId}`);
}

export async function getTransactions(accountId: number, limit = 20): Promise<TransactionsResponse> {
  const u = new URL(`${BASE}/transactions`);
  u.searchParams.set("accountId", String(accountId));
  u.searchParams.set("limit", String(limit));
  return http<TransactionsResponse>(u.toString());
}

export async function depositSimulate(
  accountId: number,
  amountCents: number,
  idempotencyKey: string
): Promise<DepositResponse> {
  return http<DepositResponse>(`${BASE}/accounts/${accountId}/deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amountCents,
      currency: "USD",
      simulate: true, // simulate-first
    }),
  });
}

export async function transfer(
  fromAccountId: number,
  toAccountId: number,
  amountCents: number,
  idempotencyKey: string
): Promise<TransferResponse> {
  return http<TransferResponse>(`${BASE}/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      fromAccountId,
      toAccountId,
      amountCents,
      currency: "USD",
    }),
  });
}

/* ===== Stripe helpers (test mode) ===== */

export interface CreatePIResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export async function stripeCreatePaymentIntent(
  amountCents: number,
  idempotencyKey: string
): Promise<CreatePIResponse> {
  return http<CreatePIResponse>(`${BASE}/stripe/create-payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amountCents,
      currency: "USD",
    }),
  });
}

export async function stripeDepositCredit(
  accountId: number,
  paymentIntentId: string,
  amountCents: number,
  idempotencyKey: string
): Promise<DepositResponse> {
  return http<DepositResponse>(`${BASE}/accounts/${accountId}/deposit/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      paymentIntentId,
      amountCents,
      currency: "USD",
    }),
  });
}
