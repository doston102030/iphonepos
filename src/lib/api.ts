const BASE_URL = 'https://orders.netdc.uz';
const USE_MOCK = true; // API ulanmasa true qiling

import {
  mockAuthApi, mockUsersApi, mockProductsApi, mockOrdersApi,
  mockDebtsApi, mockStockMovementsApi, mockReportsApi, mockSmsApi, mockSettingsApi,
} from './mockData';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Server bilan bog\'lanib bo\'lmadi. Internet aloqasini tekshiring.');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sessiya tugadi. Iltimos qayta kiring.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Xato: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginRequest { pin: string }
export interface LoginResponse { token: string; role: string; username: string }

export const authApi = USE_MOCK ? mockAuthApi : {
  login: (body: LoginRequest) => request<LoginResponse>('POST', '/api/auth/login', body),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: number; username: string; role: string; active: boolean; createdAt: string;
}
export interface UserRequest { username: string; pin: string; role: string }
export interface UserStatusRequest { active: boolean }

export const usersApi = USE_MOCK ? mockUsersApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<UserResponse>>('GET', '/api/users', undefined, { page, size }),
  getById: (id: number) => request<UserResponse>('GET', `/api/users/${id}`),
  create: (body: UserRequest) => request<UserResponse>('POST', '/api/users', body),
  update: (id: number, body: UserRequest) => request<UserResponse>('PUT', `/api/users/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/users/${id}`),
  toggleStatus: (id: number, active: boolean) =>
    request<UserResponse>('PATCH', `/api/users/${id}/status`, { active }),
};

// ─── Products ────────────────────────────────────────────────────────────────
export interface ProductResponse {
  id: number; name: string; barcode: string; price: number; costPrice: number;
  quantity: number; unit: string; minQuantity: number; createdAt: string;
}
export interface ProductRequest {
  name: string; barcode: string; price: number; costPrice: number;
  quantity: number; unit: string; minQuantity: number;
}
export interface RestockRequest { quantity: number; note?: string }
export interface OutflowRequest { quantity: number; reason: string }
export interface StockReceiveRequest {
  barcode: string; name?: string; quantity: number; price?: number; unit?: string;
}

export const productsApi = USE_MOCK ? mockProductsApi : {
  getAll: (search?: string, page = 0, size = 30) =>
    request<PagedResponse<ProductResponse>>('GET', '/api/products', undefined, { search, page, size }),
  getById: (id: number) => request<ProductResponse>('GET', `/api/products/${id}`),
  getByBarcode: (barcode: string) => request<ProductResponse>('GET', `/api/products/barcode/${barcode}`),
  create: (body: ProductRequest) => request<ProductResponse>('POST', '/api/products', body),
  update: (id: number, body: ProductRequest) => request<ProductResponse>('PUT', `/api/products/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/products/${id}`),
  restock: (id: number, body: RestockRequest) => request<ProductResponse>('POST', `/api/products/${id}/restock`, body),
  createOutflow: (id: number, body: OutflowRequest) =>
    request<OutflowResponse>('POST', `/api/products/${id}/outflow`, body),
  receive: (body: StockReceiveRequest) => request<ProductResponse>('POST', '/api/products/receive', body),
  restockHistory: (id: number) => request<StockMovementResponse[]>('GET', `/api/products/${id}/restock-history`),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export interface OrderItem { productId: number; quantity: number }
export interface OrderRequest {
  items: OrderItem[]; paymentType: 'CASH' | 'CARD' | 'DEBT';
  customerName?: string; customerPhone?: string;
}
export interface OrderItemResponse { productId: number; productName: string; quantity: number; price: number; costPrice: number }
export interface OrderResponse {
  id: number; items: OrderItemResponse[]; totalPrice: number;
  paymentType: string; cashierName: string; createdAt: string;
  customerName?: string; customerPhone?: string;
}

export const ordersApi = USE_MOCK ? mockOrdersApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<OrderResponse>>('GET', '/api/orders', undefined, { page, size }),
  create: (body: OrderRequest) => request<OrderResponse>('POST', '/api/orders', body),
};

// ─── Debts ───────────────────────────────────────────────────────────────────
export interface DebtResponse {
  id: number; customerName: string; customerPhone: string;
  amount: number; paidAmount: number; remainingAmount: number;
  status: string; description?: string; createdAt: string;
}
export interface DebtRequest {
  customerName: string; customerPhone: string; amount: number; description?: string;
}
export interface DebtPayRequest { amount: number }

export const debtsApi = USE_MOCK ? mockDebtsApi : {
  getAll: (page = 0, size = 20) =>
    request<PagedResponse<DebtResponse>>('GET', '/api/debts', undefined, { page, size }),
  create: (body: DebtRequest) => request<DebtResponse>('POST', '/api/debts', body),
  update: (id: number, body: DebtRequest) => request<DebtResponse>('PUT', `/api/debts/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/debts/${id}`),
  pay: (id: number, body: DebtPayRequest) => request<DebtResponse>('PUT', `/api/debts/${id}/pay`, body),
};

// ─── Stock Movements ─────────────────────────────────────────────────────────
export interface StockMovementResponse {
  id: number; productName: string; type: string; quantity: number; note?: string; createdAt: string;
}
export interface OutflowResponse {
  id: number; productName: string; quantity: number; reason: string; createdAt: string;
}

export const stockMovementsApi = USE_MOCK ? mockStockMovementsApi : {
  getAll: (params?: {
    from?: string; to?: string; type?: string; page?: number; size?: number;
  }) =>
    request<PagedResponse<StockMovementResponse>>('GET', '/api/stock-movements', undefined, {
      from: params?.from,
      to: params?.to,
      type: params?.type,
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    }),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface SalesReportResponse {
  totalOrders: number; totalRevenue: number; totalItems: number;
  cashAmount: number; cardAmount: number; debtAmount: number;
  totalCost: number; totalProfit: number;
}
export interface DailySalesResponse {
  date: string; totalOrders: number; totalRevenue: number; totalProfit: number;
}
export interface UserSalesResponse { username: string; totalOrders: number; totalRevenue: number }
export interface ProfitByProductResponse {
  productId: number; productName: string; quantitySold: number;
  revenue: number; cost: number; profit: number; marginPct: number;
}
export interface InventorySummaryResponse {
  totalProducts: number; lowStockCount: number; inventoryValue: number; inventoryCost: number;
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
  profitByProduct: (from: string, to: string) =>
    request<ProfitByProductResponse[]>('GET', '/api/reports/profit-by-product', undefined, { from, to }),
  inventorySummary: () =>
    request<InventorySummaryResponse>('GET', '/api/reports/inventory-summary'),
  exportCsv: (from: string, to: string) =>
    `${BASE_URL}/api/reports/export?from=${from}&to=${to}&format=csv`,
};

// ─── SMS ─────────────────────────────────────────────────────────────────────
export interface SmsSendRequest { message: string; phones: string[]; campaignName?: string }
export interface SmsCampaignResponse {
  id: number; campaignName?: string; message: string; phones: string[];
  delivered: boolean; createdAt: string;
}
export interface SmsBalanceResponse { balance: number; currency: string }

export const smsApi = USE_MOCK ? mockSmsApi : {
  getCampaigns: () => request<SmsCampaignResponse[]>('GET', '/api/sms/campaigns'),
  sendSms: (body: SmsSendRequest) => request<SmsCampaignResponse>('POST', '/api/sms/send', body),
  getBalance: () => request<SmsBalanceResponse>('GET', '/api/sms/balance'),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export interface SettingsResponse {
  storeName: string; currency: string; taxRate: number;
  address?: string; phone?: string; monthlyTarget?: number; [key: string]: unknown;
}
export type SettingsRequest = SettingsResponse;

export const settingsApi = USE_MOCK ? mockSettingsApi : {
  get: () => request<SettingsResponse>('GET', '/api/settings'),
  update: (body: SettingsRequest) => request<SettingsResponse>('PUT', '/api/settings', body),
};

// ─── Pagination ──────────────────────────────────────────────────────────────
export interface PagedResponse<T> {
  content?: T[];
  _embedded?: { [key: string]: T[] };
  page?: { size: number; totalElements: number; totalPages: number; number: number };
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export function extractContent<T>(data: PagedResponse<T>): T[] {
  if (data.content) return data.content;
  if (data._embedded) {
    const values = Object.values(data._embedded);
    if (values.length > 0) return values[0] as T[];
  }
  return [];
}

export function extractPage(data: PagedResponse<unknown>) {
  return {
    totalElements: data.page?.totalElements ?? data.totalElements ?? 0,
    totalPages: data.page?.totalPages ?? data.totalPages ?? 1,
    number: data.page?.number ?? data.number ?? 0,
    size: data.page?.size ?? data.size ?? 20,
  };
}