// API layer for the "Orders Doston API" (OpenAPI v1.0, https://api.netdc.uz).
//
// Types here mirror the server contract exactly. Where the UI needs a value the
// server does not send, it is DERIVED here from fields that do exist (and
// commented as such) — never invented. If a number cannot be derived, it is not
// exposed, so no screen can quietly render a fake zero.
//
// BASE_URL stays relative in BOTH dev and production, because the browser must
// never call api.netdc.uz directly: the backend rejects cross-origin preflights
// (OPTIONS from another origin returns 403 with no Access-Control-Allow-Origin),
// so a direct call would fail CORS on every request.
// Instead /api is proxied server-side — by vite in dev (vite.config.ts) and by a
// rewrite in production (vercel.json) — which keeps every request same-origin.
// Set VITE_API_BASE_URL only if you host somewhere without such a proxy AND the
// backend has whitelisted that origin.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

import {
  mockAuthApi, mockUsersApi, mockProductsApi, mockOrdersApi,
  mockDebtsApi, mockStockMovementsApi, mockReportsApi, mockSmsApi, mockSettingsApi,
} from './mockData';

/** The server's default "low stock" cutoff (GET /api/products/low-stock). */
export const LOW_STOCK_THRESHOLD = 5;

/** PIN is validated server-side against `\d{4}`. */
export const PIN_PATTERN = /^\d{4}$/;

function getToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Every failure request() throws, with the HTTP status attached — status 0 for
 * "the network itself is down". Callers that must tell "the record does not
 * exist" (404) apart from "the server is unreachable" check `status` instead
 * of matching message strings. Mock-mode rejections stay plain Errors.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring.");
  }

  // A 401 on the login call means "wrong PIN", not "session expired" — bouncing
  // to /login there would reload the page and wipe the error before it renders.
  const isLoginRequest = path === '/api/auth/login';

  if (response.status === 401 && !isLoginRequest) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new ApiError(401, 'Sessiya tugadi. Iltimos qayta kiring.');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Only `message` — the backend writes it in Uzbek. `error` is Spring's
    // generic English reason ("Unauthorized", "Forbidden"), and accepting it
    // shadowed every message below: a mistyped PIN showed the cashier a raw
    // "Unauthorized" instead of "PIN noto'g'ri".
    const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';
    if (serverMessage) throw new ApiError(response.status, serverMessage);
    if (response.status === 401 && isLoginRequest) throw new ApiError(401, "PIN noto'g'ri");
    if (response.status === 429) throw new ApiError(429, "Juda ko'p urinish. Bir necha daqiqa kutib, qaytadan urinib ko'ring.");
    if (response.status === 403) throw new ApiError(403, "Bu amal uchun huquqingiz yo'q.");
    if (response.status === 404) throw new ApiError(404, "Ma'lumot topilmadi.");
    if (response.status === 501) throw new ApiError(501, 'Bu xizmat hali ulanmagan.');
    if (response.status >= 500) throw new ApiError(response.status, "Server javob bermayapti. Birozdan so'ng qaytadan urinib ko'ring.");
    throw new ApiError(response.status, `Xato: ${response.status}`);
  }

  return data as T;
}

// ─── Pagination ──────────────────────────────────────────────────────────────
// Spring's PagedModel: { content: [...], page: { size, number, totalElements, totalPages } }
export interface PageMetadata {
  size: number; number: number; totalElements: number; totalPages: number;
}
export interface PagedResponse<T> {
  content?: T[];
  page?: PageMetadata;
}

export function extractContent<T>(data: PagedResponse<T>): T[] {
  return data.content ?? [];
}

export function extractPage(data: PagedResponse<unknown>) {
  return {
    totalElements: data.page?.totalElements ?? 0,
    totalPages: data.page?.totalPages ?? 1,
    number: data.page?.number ?? 0,
    size: data.page?.size ?? 20,
  };
}

/**
 * Reads every page of a paged endpoint — for the screens that must count or
 * search across the whole collection (the till grid, Ombor, Qarzlar), because
 * the server offers no "in stock only", no status filter and no name search.
 *
 * `truncated` is true when the collection is bigger than the ceiling below, so
 * a caller can say so out loud instead of quietly presenting a partial list as
 * the complete one.
 */
const FETCH_ALL_PAGE_SIZE = 100;
const FETCH_ALL_MAX_PAGES = 20; // 2000 rows — beyond that, the UI must paginate.

export interface FetchAllResult<T> { items: T[]; truncated: boolean }

export async function fetchAllPages<T extends { id: number }>(
  fetchPage: (page: number, size: number) => Promise<PagedResponse<T>>,
): Promise<FetchAllResult<T>> {
  const first = await fetchPage(0, FETCH_ALL_PAGE_SIZE);

  // Keyed by id, not appended: rows created or deleted by another cashier while
  // we page shift every later offset, which otherwise returns a row twice (a
  // duplicate React key, double-counted in every total) or skips one entirely.
  const byId = new Map<number, T>();
  for (const item of extractContent(first)) byId.set(item.id, item);

  const { totalPages } = extractPage(first);
  const lastPage = Math.min(totalPages, FETCH_ALL_MAX_PAGES);
  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 1, FETCH_ALL_PAGE_SIZE)),
    );
    for (const page of rest) {
      for (const item of extractContent(page)) byId.set(item.id, item);
    }
  }

  return { items: [...byId.values()], truncated: totalPages > lastPage };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
/** The server only knows these two roles — there is no ADMIN. */
export type Role = 'SUPER_ADMIN' | 'CASHIER';

export interface LoginRequest { pin: string }
export interface LoginResponse { id: number; token: string; fullName: string; role: Role }
export interface MeResponse { id: number; fullName: string; role: Role }

export const authApi = USE_MOCK ? mockAuthApi : {
  login: (body: LoginRequest) => request<LoginResponse>('POST', '/api/auth/login', body),
  /** Verifies a stored token is still valid (used on app boot). */
  me: () => request<MeResponse>('GET', '/api/auth/me'),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export interface UserRequest { pin: string; fullName: string; role: Role }
/** PUT takes UserUpdateRequest: `pin` is optional — omit it to keep the current one. */
export interface UserUpdateRequest { pin?: string; fullName: string; role: Role }
export interface UserResponse { id: number; fullName: string; role: Role; active: boolean }
export interface UserStatusRequest { active: boolean }

export const usersApi = USE_MOCK ? mockUsersApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<UserResponse>>('GET', '/api/users', undefined, { page, size }),
  getById: (id: number) => request<UserResponse>('GET', `/api/users/${id}`),
  create: (body: UserRequest) => request<UserResponse>('POST', '/api/users', body),
  update: (id: number, body: UserUpdateRequest) => request<UserResponse>('PUT', `/api/users/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/users/${id}`),
  toggleStatus: (id: number, active: boolean) =>
    request<UserResponse>('PATCH', `/api/users/${id}/status`, { active } satisfies UserStatusRequest),
};

// ─── Products ────────────────────────────────────────────────────────────────
// The server has no `unit` or `minQuantity` per product; "dona" is a UI word and
// low stock is decided by LOW_STOCK_THRESHOLD, matching /api/products/low-stock.
export interface ProductRequest {
  name: string; barcode?: string;
  purchasePrice: number; price: number; stockQuantity: number;
}
export interface ProductResponse {
  id: number; name: string; barcode?: string;
  purchasePrice: number; price: number; stockQuantity: number;
}

export interface RestockRequest { quantity: number }

export type OutflowReason = 'DAMAGED' | 'LOST' | 'RETURNED';
export interface OutflowRequest { quantity: number; reason: OutflowReason; note?: string }
export interface OutflowResponse {
  id: number; productName: string; quantity: number;
  reason: OutflowReason; note?: string; createdAt: string;
}

export interface BarcodeLookupResponse {
  barcode: string; found: boolean; name?: string; brand?: string;
}

export const productsApi = USE_MOCK ? mockProductsApi : {
  getAll: (search?: string, page = 0, size = 30) =>
    request<PagedResponse<ProductResponse>>('GET', '/api/products', undefined, { search, page, size }),
  getById: (id: number) => request<ProductResponse>('GET', `/api/products/${id}`),
  getByBarcode: (barcode: string) =>
    request<ProductResponse>('GET', `/api/products/barcode/${encodeURIComponent(barcode)}`),
  /** Falls back to an external catalogue when the barcode isn't in our DB. */
  externalLookup: (barcode: string) =>
    request<BarcodeLookupResponse>('GET', `/api/products/barcode/${encodeURIComponent(barcode)}/external-lookup`),
  lowStock: (threshold = LOW_STOCK_THRESHOLD, page = 0, size = 30) =>
    request<PagedResponse<ProductResponse>>('GET', '/api/products/low-stock', undefined, { threshold, page, size }),
  create: (body: ProductRequest) => request<ProductResponse>('POST', '/api/products', body),
  update: (id: number, body: ProductRequest) => request<ProductResponse>('PUT', `/api/products/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/products/${id}`),
  restock: (id: number, body: RestockRequest) =>
    request<ProductResponse>('POST', `/api/products/${id}/restock`, body),
  createOutflow: (id: number, body: OutflowRequest) =>
    request<OutflowResponse>('POST', `/api/products/${id}/outflow`, body),
  restockHistory: (id: number) =>
    request<StockMovementResponse[]>('GET', `/api/products/${id}/restock-history`),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export type PaymentMethod = 'CASH' | 'CARD' | 'MIXED' | 'CREDIT';

export interface OrderItemRequest { productId: number; quantity: number }
export interface OrderRequest {
  items: OrderItemRequest[];
  paymentMethod: PaymentMethod;
  discountAmount?: number;
  customerName?: string;
  customerPhone?: string;
  paidAmount?: number;
}
export interface OrderItemResponse {
  productName: string; quantity: number; unitPrice: number; profit: number;
}
export interface OrderResponse {
  id: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
  paymentMethod: PaymentMethod;
  items: OrderItemResponse[];
}

/**
 * A stable key for one attempted sale. POST /api/orders accepts an
 * `Idempotency-Key` header, and the till is exactly where it matters: if the
 * response is lost to a dropped connection and the cashier presses "Tasdiqlash"
 * again, the same key makes the server return the sale it already recorded
 * instead of recording it twice and taking the customer's money twice.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const ordersApi = USE_MOCK ? mockOrdersApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<OrderResponse>>('GET', '/api/orders', undefined, { page, size }),
  getById: (id: number) => request<OrderResponse>('GET', `/api/orders/${id}`),
  create: (body: OrderRequest, idempotencyKey?: string) =>
    request<OrderResponse>('POST', '/api/orders', body, undefined,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
};

// ─── Debts ───────────────────────────────────────────────────────────────────
export type DebtStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface DebtRequest {
  customerName: string; phone?: string; amount: number; orderId?: number;
}
export interface DebtResponse {
  id: number;
  customerName: string;
  phone?: string;
  amount: number;
  paidAmount: number;
  createdAt: string;
  status: DebtStatus;
  orderId?: number;
}
export interface DebtPayRequest { amount: number }
export interface DebtPaymentResponse {
  id: number; amount: number; performedBy: string; createdAt: string;
}

/** Not sent by the server — derived from the two amounts it does send. */
export function remainingAmount(debt: Pick<DebtResponse, 'amount' | 'paidAmount'>): number {
  return Math.max(0, (debt.amount ?? 0) - (debt.paidAmount ?? 0));
}

export const debtsApi = USE_MOCK ? mockDebtsApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<DebtResponse>>('GET', '/api/debts', undefined, { page, size }),
  create: (body: DebtRequest) => request<DebtResponse>('POST', '/api/debts', body),
  update: (id: number, body: DebtRequest) => request<DebtResponse>('PUT', `/api/debts/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/debts/${id}`),
  pay: (id: number, body: DebtPayRequest) => request<DebtResponse>('PUT', `/api/debts/${id}/pay`, body),
  getPayments: (id: number) => request<DebtPaymentResponse[]>('GET', `/api/debts/${id}/payments`),
};

// ─── Stock movements ─────────────────────────────────────────────────────────
export type StockMovementType = 'IN' | 'OUT' | 'SALE' | 'ADJUSTMENT';

export interface StockMovementResponse {
  id: number;
  type: StockMovementType;
  productName: string;
  quantity: number;
  performedBy: string;
  reason?: string;
  createdAt: string;
}

export const stockMovementsApi = USE_MOCK ? mockStockMovementsApi : {
  getAll: (params?: { from?: string; to?: string; type?: string; page?: number; size?: number }) =>
    request<PagedResponse<StockMovementResponse>>('GET', '/api/stock-movements', undefined, {
      from: params?.from,
      to: params?.to,
      type: params?.type,
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    }),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
// The server reports revenue, profit and credit sales. It does NOT break revenue
// down by cash vs card, and it does not report item counts or inventory value —
// so no screen should claim to show those.
export interface ProductSalesResponse {
  productId: number; productName: string; quantitySold: number;
}
export interface SalesReportResponse {
  from: string;
  to: string;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  /** Portion of revenue sold on credit (qarzga). */
  creditSalesAmount: number;
  topProducts: ProductSalesResponse[];
}
export interface DailySalesResponse {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  creditSalesAmount: number;
}
export interface UserSalesResponse {
  userId: number; fullName: string; role: Role;
  totalOrders: number; totalRevenue: number; totalProfit: number;
}

/** Cost of goods sold — not sent, but revenue minus profit is exactly that. */
export function totalCost(r: Pick<SalesReportResponse, 'totalRevenue' | 'totalProfit'>): number {
  return (r.totalRevenue ?? 0) - (r.totalProfit ?? 0);
}

/** Profit as a percentage of revenue. */
export function marginPct(r: Pick<SalesReportResponse, 'totalRevenue' | 'totalProfit'>): number {
  if (!r.totalRevenue) return 0;
  return Math.round((r.totalProfit / r.totalRevenue) * 1000) / 10;
}

export const reportsApi = USE_MOCK ? mockReportsApi : {
  daily: (date?: string) =>
    request<SalesReportResponse>('GET', '/api/reports/daily', undefined, { date }),
  range: (from: string, to: string) =>
    request<SalesReportResponse>('GET', '/api/reports', undefined, { from, to }),
  rangeDaily: (from: string, to: string) =>
    request<DailySalesResponse[]>('GET', '/api/reports/range-daily', undefined, { from, to }),
  byUser: (from: string, to: string) =>
    request<UserSalesResponse[]>('GET', '/api/reports/by-user', undefined, { from, to }),
  exportCsv: (from: string, to: string) =>
    `${BASE_URL}/api/reports/export?from=${from}&to=${to}&format=csv`,
};

/**
 * Inventory overview. The server has no summary endpoint, so this asks the two
 * paged endpoints for their totals only (size=1) and reads `totalElements`.
 * Inventory *value* is deliberately absent — it cannot be computed without
 * pulling every product.
 */
export async function inventorySummary(): Promise<{ totalProducts: number; lowStockCount: number }> {
  const [all, low] = await Promise.all([
    productsApi.getAll(undefined, 0, 1),
    productsApi.lowStock(LOW_STOCK_THRESHOLD, 0, 1),
  ]);
  return {
    totalProducts: extractPage(all).totalElements,
    lowStockCount: extractPage(low).totalElements,
  };
}

// ─── SMS ─────────────────────────────────────────────────────────────────────
export interface SmsSendRequest { recipients: string[]; message: string }
export interface SmsCampaignResponse {
  id: number;
  message: string;
  /** The server stores recipients as a single joined string. */
  recipients: string;
  createdAt: string;
  smsCount: number;
  delivered: boolean;
}
export interface SmsBalanceResponse { balance: number; mock: boolean }

/** Splits the server's joined recipient string back into individual numbers. */
export function parseRecipients(recipients: string | undefined): string[] {
  if (!recipients) return [];
  return recipients.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
}

export const smsApi = USE_MOCK ? mockSmsApi : {
  getCampaigns: (page = 0, size = 20) =>
    request<PagedResponse<SmsCampaignResponse>>('GET', '/api/sms/campaigns', undefined, { page, size }),
  /** Returns 501 while the Eskiz integration is not wired up. */
  sendSms: (body: SmsSendRequest) => request<SmsCampaignResponse>('POST', '/api/sms/send', body),
  getBalance: () => request<SmsBalanceResponse>('GET', '/api/sms/balance'),
};

// ─── Settings ────────────────────────────────────────────────────────────────
// The server stores only these two. Store name, currency, tax rate and monthly
// target do not exist in the API — screens must not pretend to save them.
export interface SettingsRequest { language: string; darkMode: boolean }
export interface SettingsResponse { id: number; language: string; darkMode: boolean }

export const settingsApi = USE_MOCK ? mockSettingsApi : {
  get: () => request<SettingsResponse>('GET', '/api/settings'),
  update: (body: SettingsRequest) => request<SettingsResponse>('PUT', '/api/settings', body),
};
