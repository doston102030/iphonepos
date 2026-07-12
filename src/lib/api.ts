const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://orders.netdc.uz';
// Mock ma'lumotlar faqat local/demo muhit uchun aniq yoqilganda ishlatiladi.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

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

type ApiRole = 'SUPER_ADMIN' | 'CASHIER';
type ApiUser = { id: number; fullName: string; role: ApiRole; active: boolean };
type ApiProduct = { id: number; name: string; barcode?: string; purchasePrice: number; price: number; stockQuantity: number };

function mapRoleFromApi(role: ApiRole): string { return role === 'CASHIER' ? 'KASSIR' : role; }
function mapRoleToApi(role: string): ApiRole { return role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CASHIER'; }
function mapPaymentFromApi(payment: string): string { return payment === 'CREDIT' ? 'DEBT' : payment; }
function mapPaymentToApi(payment: string): 'CASH' | 'CARD' | 'CREDIT' { return payment === 'DEBT' ? 'CREDIT' : payment === 'CARD' ? 'CARD' : 'CASH'; }
function mapPage<T, R>(page: PagedResponse<T>, mapper: (item: T) => R): PagedResponse<R> {
  return {
    content: (page.content ?? []).map(mapper),
    page: page.page,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    number: page.number,
    size: page.size,
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginRequest { pin: string }
export interface LoginResponse { token: string; role: string; username: string }

export const authApi = USE_MOCK ? mockAuthApi : {
  login: async (body: LoginRequest) => {
    const data = await request<{ token: string; fullName: string; role: ApiRole }>('POST', '/api/auth/login', body);
    return { token: data.token, username: data.fullName, role: mapRoleFromApi(data.role) };
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: number; username: string; role: string; active: boolean; createdAt: string;
}
export interface UserRequest { username: string; pin: string; role: string }
export interface UserStatusRequest { active: boolean }

export const usersApi = USE_MOCK ? mockUsersApi : {
  getAll: async (page = 0, size = 20) => mapPage(
    await request<PagedResponse<ApiUser>>('GET', '/api/users', undefined, { page, size }),
    user => ({ id: user.id, username: user.fullName, role: mapRoleFromApi(user.role), active: user.active, createdAt: '' }),
  ),
  getById: async (id: number) => {
    const user = await request<ApiUser>('GET', `/api/users/${id}`);
    return { id: user.id, username: user.fullName, role: mapRoleFromApi(user.role), active: user.active, createdAt: '' };
  },
  create: async (body: UserRequest) => {
    const user = await request<ApiUser>('POST', '/api/users', { fullName: body.username, pin: body.pin, role: mapRoleToApi(body.role) });
    return { id: user.id, username: user.fullName, role: mapRoleFromApi(user.role), active: user.active, createdAt: '' };
  },
  update: async (id: number, body: UserRequest) => {
    const user = await request<ApiUser>('PUT', `/api/users/${id}`, { fullName: body.username, pin: body.pin, role: mapRoleToApi(body.role) });
    return { id: user.id, username: user.fullName, role: mapRoleFromApi(user.role), active: user.active, createdAt: '' };
  },
  delete: (id: number) => request<void>('DELETE', `/api/users/${id}`),
  toggleStatus: async (id: number, active: boolean) => {
    const user = await request<ApiUser>('PATCH', `/api/users/${id}/status`, { active });
    return { id: user.id, username: user.fullName, role: mapRoleFromApi(user.role), active: user.active, createdAt: '' };
  },
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
  barcode: string; name?: string; quantity: number; price?: number; costPrice?: number; unit?: string;
}

export const productsApi = USE_MOCK ? mockProductsApi : {
  getAll: async (search?: string, page = 0, size = 30) => mapPage(
    await request<PagedResponse<ApiProduct>>('GET', '/api/products', undefined, { search, page, size }),
    product => ({ id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' }),
  ),
  getById: async (id: number) => {
    const product = await request<ApiProduct>('GET', `/api/products/${id}`);
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  getByBarcode: async (barcode: string) => {
    const product = await request<ApiProduct>('GET', `/api/products/barcode/${encodeURIComponent(barcode)}`);
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  create: async (body: ProductRequest) => {
    const product = await request<ApiProduct>('POST', '/api/products', { name: body.name, barcode: body.barcode, purchasePrice: body.costPrice, price: body.price, stockQuantity: body.quantity });
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  update: async (id: number, body: ProductRequest) => {
    const product = await request<ApiProduct>('PUT', `/api/products/${id}`, { name: body.name, barcode: body.barcode, purchasePrice: body.costPrice, price: body.price, stockQuantity: body.quantity });
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  delete: (id: number) => request<void>('DELETE', `/api/products/${id}`),
  restock: async (id: number, body: RestockRequest) => {
    const product = await request<ApiProduct>('POST', `/api/products/${id}/restock`, { quantity: body.quantity });
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  createOutflow: async (id: number, body: OutflowRequest) => {
    const payload = {
      quantity: body.quantity,
      reason: ['DAMAGED', 'LOST', 'RETURNED'].includes(body.reason) ? body.reason : 'DAMAGED',
      note: body.reason
    };
    const data = await request<any>('POST', `/api/products/${id}/outflow`, payload);
    return { id: data.id, productName: data.productName, quantity: data.quantity, reason: data.reason, createdAt: data.createdAt };
  },
  receive: async (body: StockReceiveRequest) => {
    const product = await request<ApiProduct>('POST', '/api/products/receive', { barcode: body.barcode, name: body.name, purchasePrice: body.costPrice ?? 0, price: body.price ?? 0, quantity: body.quantity });
    return { id: product.id, name: product.name, barcode: product.barcode ?? '', price: product.price, costPrice: product.purchasePrice, quantity: product.stockQuantity, unit: 'dona', minQuantity: 0, createdAt: '' };
  },
  restockHistory: async (id: number) => (await request<any[]>('GET', `/api/products/${id}/restock-history`)).map(item => ({ id: item.id, productName: item.productName, type: item.type, quantity: item.quantity, note: item.reason, createdAt: item.createdAt })),
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
  getAll: async (page = 0, size = 20) => {
    const res = await request<PagedResponse<any>>('GET', '/api/orders', undefined, { page, size });
    return mapPage(res, order => ({
      id: order.id,
      items: order.items.map((i: any) => ({
        productId: 0,
        productName: i.productName,
        quantity: i.quantity,
        price: i.unitPrice,
        costPrice: i.unitPrice - (i.profit || 0) / (i.quantity || 1)
      })),
      totalPrice: order.totalAmount,
      paymentType: mapPaymentFromApi(order.paymentMethod),
      cashierName: '', 
      createdAt: order.createdAt,
    }));
  },
  create: async (body: OrderRequest) => {
    const payload = {
      items: body.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      paymentMethod: mapPaymentToApi(body.paymentType),
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      discountAmount: 0,
      paidAmount: body.paymentType !== 'DEBT' ? undefined : 0
    };
    const data = await request<any>('POST', '/api/orders', payload);
    return {
      id: data.id,
      items: (data.items || []).map((i: any) => ({ 
        productId: 0, productName: i.productName, quantity: i.quantity, price: i.unitPrice, costPrice: 0 
      })),
      totalPrice: data.totalAmount,
      paymentType: mapPaymentFromApi(data.paymentMethod),
      cashierName: '',
      createdAt: data.createdAt,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
    };
  },
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
export interface DebtPaymentResponse { id: number; amount: number; createdAt: string }

function mapDebtFromApi(debt: any): DebtResponse {
  return {
    id: debt.id,
    customerName: debt.customerName,
    customerPhone: debt.phone || '',
    amount: debt.amount,
    paidAmount: debt.paidAmount,
    remainingAmount: debt.amount - debt.paidAmount,
    status: debt.status,
    createdAt: debt.createdAt,
  };
}

export const debtsApi = USE_MOCK ? mockDebtsApi : {
  getAll: async (page = 0, size = 20) => {
    const res = await request<PagedResponse<any>>('GET', '/api/debts', undefined, { page, size });
    return mapPage(res, mapDebtFromApi);
  },
  create: async (body: DebtRequest) => {
    const payload = { customerName: body.customerName, phone: body.customerPhone, amount: body.amount };
    const data = await request<any>('POST', '/api/debts', payload);
    return mapDebtFromApi(data);
  },
  update: async (id: number, body: DebtRequest) => {
    const payload = { customerName: body.customerName, phone: body.customerPhone, amount: body.amount };
    const data = await request<any>('PUT', `/api/debts/${id}`, payload);
    return mapDebtFromApi(data);
  },
  delete: (id: number) => request<void>('DELETE', `/api/debts/${id}`),
  pay: async (id: number, body: DebtPayRequest) => {
    const data = await request<any>('PUT', `/api/debts/${id}/pay`, body);
    return mapDebtFromApi(data);
  },
  getPayments: (id: number) => request<DebtPaymentResponse[]>('GET', `/api/debts/${id}/payments`),
};

// ─── Stock Movements ─────────────────────────────────────────────────────────
export interface StockMovementResponse {
  id: number; productName: string; type: string; quantity: number; note?: string; createdAt: string;
}
export interface OutflowResponse {
  id: number; productName: string; quantity: number; reason: string; createdAt: string;
}

export const stockMovementsApi = USE_MOCK ? mockStockMovementsApi : {
  getAll: async (params?: {
    from?: string; to?: string; type?: string; page?: number; size?: number;
  }) => {
    const res = await request<PagedResponse<any>>('GET', '/api/stock-movements', undefined, {
      from: params?.from,
      to: params?.to,
      type: params?.type,
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    });
    return mapPage(res, item => ({
      id: item.id, productName: item.productName, type: item.type, quantity: item.quantity, note: item.reason, createdAt: item.createdAt
    }));
  }
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

function mapSalesReport(data: any): SalesReportResponse {
  return {
    totalOrders: data.totalOrders || 0,
    totalRevenue: data.totalRevenue || 0,
    totalProfit: data.totalProfit || 0,
    totalItems: 0,
    cashAmount: (data.totalRevenue || 0) - (data.creditSalesAmount || 0),
    cardAmount: 0,
    debtAmount: data.creditSalesAmount || 0,
    totalCost: (data.totalRevenue || 0) - (data.totalProfit || 0),
  };
}

export const reportsApi = USE_MOCK ? mockReportsApi : {
  daily: async (date?: string) => {
    const data = await request<any>('GET', '/api/reports/daily', undefined, { date });
    return mapSalesReport(data);
  },
  range: async (from: string, to: string) => {
    const data = await request<any>('GET', '/api/reports', undefined, { from, to });
    return mapSalesReport(data);
  },
  rangeDaily: async (from: string, to: string) => {
    const data = await request<any[]>('GET', '/api/reports/range-daily', undefined, { from, to });
    return data;
  },
  byUser: async (from: string, to: string) => {
    const data = await request<any[]>('GET', '/api/reports/by-user', undefined, { from, to });
    return data.map(u => ({ username: u.fullName, totalOrders: u.totalOrders, totalRevenue: u.totalRevenue }));
  },
  profitByProduct: async (from: string, to: string) => {
    // Backend API does not have profitByProduct yet, return empty list to not break UI
    return [] as ProfitByProductResponse[];
  },
  inventorySummary: async () => {
    // Backend API does not have inventorySummary yet, return zeros
    return { totalProducts: 0, lowStockCount: 0, inventoryValue: 0, inventoryCost: 0 };
  },
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
  getCampaigns: async () => {
    const data = await request<any[]>('GET', '/api/sms/campaigns');
    return data.map(c => ({
      id: c.id, message: c.message, phones: [c.recipients || ''], delivered: c.delivered, createdAt: c.createdAt
    }));
  },
  sendSms: async (body: SmsSendRequest) => {
    const payload = { message: body.message, recipients: body.phones };
    const data = await request<any>('POST', '/api/sms/send', payload);
    return {
      id: data.id, message: data.message, phones: [data.recipients || ''], delivered: data.delivered, createdAt: data.createdAt
    };
  },
  getBalance: async () => {
    const data = await request<any>('GET', '/api/sms/balance');
    return { balance: data.balance, currency: 'so\'m' };
  },
};

// ─── Settings ────────────────────────────────────────────────────────────────
export interface SettingsResponse {
  storeName: string; currency: string; taxRate: number;
  address?: string; phone?: string; monthlyTarget?: number; [key: string]: unknown;
}
export type SettingsRequest = SettingsResponse;

export const settingsApi = USE_MOCK ? mockSettingsApi : {
  get: async () => {
    const data = await request<any>('GET', '/api/settings').catch(() => ({}));
    return {
      storeName: 'Do\'kon', currency: 'UZS', taxRate: 0,
      ...data
    };
  },
  update: async (body: SettingsRequest) => {
    const payload = { language: body.language || 'uz', darkMode: !!body.darkMode };
    const data = await request<any>('PUT', '/api/settings', payload);
    return {
      storeName: 'Do\'kon', currency: 'UZS', taxRate: 0,
      ...data
    };
  },
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
