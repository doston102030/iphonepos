import type {
  LoginResponse, UserResponse, ProductResponse, OrderResponse, OrderItemResponse,
  DebtResponse, DebtPaymentResponse, StockMovementResponse, SmsCampaignResponse, SmsBalanceResponse,
  SalesReportResponse, DailySalesResponse, UserSalesResponse, ProfitByProductResponse,
  InventorySummaryResponse, SettingsResponse, PagedResponse,
} from './api';

// ── Date helpers (all dates relative to "today" so demo data always looks live) ──
function daysAgoISO(n: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Mock users ──────────────────────────────────────────────────────────────
const MOCK_USERS: UserResponse[] = [
  { id: 1, username: 'admin', role: 'SUPER_ADMIN', active: true, createdAt: daysAgoISO(190, 8) },
  { id: 2, username: 'doston', role: 'ADMIN', active: true, createdAt: daysAgoISO(150, 9) },
  { id: 3, username: 'kassir1', role: 'KASSIR', active: true, createdAt: daysAgoISO(120, 10) },
  { id: 4, username: 'kassir2', role: 'KASSIR', active: false, createdAt: daysAgoISO(90, 11) },
];

// ── Mock products (price = sotish narxi, costPrice = kelish narxi) ──────────
let mockProducts: ProductResponse[] = [
  { id: 1, name: 'Coca-Cola 0.5L', barcode: '4870201000014', price: 8000, costPrice: 5500, quantity: 120, unit: 'dona', minQuantity: 20, createdAt: daysAgoISO(190, 8) },
  { id: 2, name: 'Pepsi 1L', barcode: '4870201000021', price: 12000, costPrice: 8500, quantity: 80, unit: 'dona', minQuantity: 15, createdAt: daysAgoISO(185, 9) },
  { id: 3, name: 'Suv 1.5L', barcode: '4870201000038', price: 4500, costPrice: 2800, quantity: 200, unit: 'dona', minQuantity: 50, createdAt: daysAgoISO(183, 10) },
  { id: 4, name: 'Non (katta)', barcode: '4870201000045', price: 7000, costPrice: 4500, quantity: 8, unit: 'dona', minQuantity: 10, createdAt: daysAgoISO(180, 11) },
  { id: 5, name: 'Sut 1L', barcode: '4870201000052', price: 14000, costPrice: 10500, quantity: 45, unit: 'litr', minQuantity: 10, createdAt: daysAgoISO(165, 8) },
  { id: 6, name: 'Yog\' 1kg', barcode: '4870201000069', price: 28000, costPrice: 22000, quantity: 30, unit: 'kg', minQuantity: 5, createdAt: daysAgoISO(155, 9) },
  { id: 7, name: 'Shakar 1kg', barcode: '4870201000076', price: 18000, costPrice: 15000, quantity: 60, unit: 'kg', minQuantity: 10, createdAt: daysAgoISO(150, 10) },
  { id: 8, name: 'Un 2kg', barcode: '4870201000083', price: 22000, costPrice: 17500, quantity: 4, unit: 'kg', minQuantity: 5, createdAt: daysAgoISO(145, 11) },
];
let nextProductId = 9;

// ── Mock orders ─────────────────────────────────────────────────────────────
function orderItem(productId: number, quantity: number): OrderItemResponse {
  const p = mockProducts.find(pr => pr.id === productId)!;
  return { productId: p.id, productName: p.name, quantity, price: p.price, costPrice: p.costPrice };
}
function buildOrder(
  id: number, dayAgo: number, hour: number, minute: number,
  items: [number, number][], paymentType: 'CASH' | 'CARD' | 'DEBT', cashierName: string,
  customer?: { name: string; phone: string },
): OrderResponse {
  const orderItems = items.map(([productId, qty]) => orderItem(productId, qty));
  const totalPrice = orderItems.reduce((s, it) => s + it.price * it.quantity, 0);
  return {
    id, items: orderItems, totalPrice, paymentType, cashierName,
    customerName: customer?.name, customerPhone: customer?.phone,
    createdAt: daysAgoISO(dayAgo, hour, minute),
  };
}

let mockOrders: OrderResponse[] = [
  buildOrder(1, 13, 9, 10, [[1, 4], [3, 2]], 'CASH', 'doston'),
  buildOrder(2, 13, 15, 40, [[2, 2], [7, 1]], 'CARD', 'kassir1'),
  buildOrder(3, 12, 10, 5, [[5, 2], [4, 3]], 'CASH', 'kassir1'),
  buildOrder(4, 12, 17, 20, [[6, 1]], 'CARD', 'kassir2'),
  buildOrder(5, 11, 9, 45, [[1, 6], [3, 4]], 'CASH', 'doston'),
  buildOrder(6, 11, 13, 15, [[8, 2], [7, 1]], 'DEBT', 'kassir1', { name: 'Alisher', phone: '+998901112233' }),
  buildOrder(7, 10, 11, 0, [[2, 3]], 'CARD', 'kassir2'),
  buildOrder(8, 10, 16, 30, [[3, 5], [5, 1]], 'CASH', 'doston'),
  buildOrder(9, 9, 9, 20, [[1, 2], [4, 1]], 'CASH', 'kassir1'),
  buildOrder(10, 9, 14, 10, [[6, 1], [8, 1]], 'CARD', 'kassir1'),
  buildOrder(11, 8, 10, 50, [[7, 2]], 'CASH', 'kassir2'),
  buildOrder(12, 8, 18, 5, [[1, 3], [2, 1]], 'DEBT', 'doston', { name: 'Dilnoza', phone: '+998901334455' }),
  buildOrder(13, 7, 9, 30, [[3, 6], [1, 2]], 'CASH', 'kassir1'),
  buildOrder(14, 7, 12, 45, [[5, 3]], 'CARD', 'kassir2'),
  buildOrder(15, 6, 10, 15, [[4, 2], [7, 1]], 'CASH', 'doston'),
  buildOrder(16, 6, 16, 0, [[2, 2], [8, 1]], 'CARD', 'kassir1'),
  buildOrder(17, 5, 9, 10, [[1, 5], [3, 3]], 'CASH', 'kassir1'),
  buildOrder(18, 5, 15, 20, [[6, 1], [7, 2]], 'DEBT', 'kassir2', { name: 'Eldor', phone: '+998901445566' }),
  buildOrder(19, 4, 11, 30, [[3, 4], [5, 1]], 'CASH', 'doston'),
  buildOrder(20, 4, 17, 40, [[2, 1], [1, 2]], 'CARD', 'kassir1'),
  buildOrder(21, 3, 9, 25, [[4, 1], [8, 1]], 'CASH', 'kassir2'),
  buildOrder(22, 3, 14, 50, [[1, 4], [7, 1]], 'CARD', 'doston'),
  buildOrder(23, 2, 10, 10, [[3, 3], [6, 1]], 'CASH', 'kassir1'),
  buildOrder(24, 2, 16, 20, [[2, 2], [5, 1]], 'DEBT', 'kassir1', { name: 'Bobur', phone: '+998901223344' }),
  buildOrder(25, 1, 9, 40, [[1, 3], [3, 2]], 'CASH', 'kassir2'),
  buildOrder(26, 1, 13, 15, [[7, 1], [8, 1]], 'CARD', 'doston'),
  buildOrder(27, 0, 8, 30, [[1, 2], [3, 1]], 'CASH', 'doston'),
  buildOrder(28, 0, 9, 45, [[5, 1], [4, 2]], 'CARD', 'kassir1'),
  buildOrder(29, 0, 10, 20, [[2, 1], [6, 1]], 'CASH', 'kassir1'),
];
let nextOrderId = 30;

// ── Mock debts ──────────────────────────────────────────────────────────────
let mockDebts: DebtResponse[] = [
  { id: 1, customerName: 'Alisher Karimov', customerPhone: '+998901112233', amount: 150000, paidAmount: 50000, remainingAmount: 100000, status: 'PARTIAL', description: 'Har oylik xarid', createdAt: daysAgoISO(40, 10) },
  { id: 2, customerName: 'Bobur Yusupov', customerPhone: '+998901223344', amount: 85000, paidAmount: 85000, remainingAmount: 0, status: 'PAID', description: undefined, createdAt: daysAgoISO(25, 11, 30) },
  { id: 3, customerName: 'Dilnoza Nazarova', customerPhone: '+998901334455', amount: 200000, paidAmount: 0, remainingAmount: 200000, status: 'UNPAID', description: 'Tovar qarz', createdAt: daysAgoISO(10, 9) },
  { id: 4, customerName: 'Eldor Toshmatov', customerPhone: '+998901445566', amount: 50000, paidAmount: 20000, remainingAmount: 30000, status: 'PARTIAL', description: undefined, createdAt: daysAgoISO(6, 14) },
];
let nextDebtId = 5;

let mockDebtPayments: Record<number, DebtPaymentResponse[]> = {
  1: [{ id: 1, amount: 50000, createdAt: daysAgoISO(15, 12) }],
  2: [
    { id: 2, amount: 40000, createdAt: daysAgoISO(20, 10) },
    { id: 3, amount: 45000, createdAt: daysAgoISO(9, 16, 30) },
  ],
  4: [{ id: 4, amount: 20000, createdAt: daysAgoISO(2, 11) }],
};
let nextPaymentId = 5;

// ── Mock stock movements ────────────────────────────────────────────────────
let mockMovements: StockMovementResponse[] = [
  { id: 1, productName: 'Coca-Cola 0.5L', type: 'IN', quantity: 50, note: 'Yangi partiya', createdAt: daysAgoISO(5, 8) },
  { id: 2, productName: 'Pepsi 1L', type: 'SALE', quantity: 5, note: 'Sotildi', createdAt: daysAgoISO(4, 10, 30) },
  { id: 3, productName: 'Non (katta)', type: 'OUT', quantity: 3, note: 'Yaroqsiz', createdAt: daysAgoISO(4, 14) },
  { id: 4, productName: 'Suv 1.5L', type: 'IN', quantity: 100, note: 'Ombor to\'ldirish', createdAt: daysAgoISO(3, 9) },
  { id: 5, productName: 'Shakar 1kg', type: 'ADJUSTMENT', quantity: 2, note: 'Inventarizatsiya', createdAt: daysAgoISO(2, 16) },
  { id: 6, productName: 'Sut 1L', type: 'SALE', quantity: 3, note: 'Sotildi', createdAt: daysAgoISO(1, 8, 30) },
];
let nextMovementId = 7;

// ── Mock SMS ────────────────────────────────────────────────────────────────
let mockCampaigns: SmsCampaignResponse[] = [
  { id: 1, campaignName: 'Bayram aksiyasi', message: 'Qodir Kecha aksiyamizdan foydalaning! -20%', phones: ['+998901112233', '+998901223344'], delivered: true, createdAt: daysAgoISO(22, 10) },
  { id: 2, campaignName: 'Yangi mahsulot', message: 'Yangi mahsulotlar keldi! Bugun tashrif buyuring.', phones: ['+998901334455'], delivered: true, createdAt: daysAgoISO(11, 14, 30) },
];
let nextCampaignId = 3;

const MOCK_SETTINGS: SettingsResponse = {
  storeName: 'NetDC Do\'kon',
  currency: 'UZS',
  taxRate: 0,
  address: 'Toshkent sh., Chilonzor tumani',
  phone: '+998712345678',
  monthlyTarget: 5000000,
};

// ── Pagination helper ───────────────────────────────────────────────────────
function paginate<T>(items: T[], page: number, size: number): PagedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = page * size;
  const content = items.slice(start, start + size);
  return { content, page: { size, totalElements: total, totalPages, number: page } };
}

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function ordersInRange(from?: string, to?: string): OrderResponse[] {
  return mockOrders.filter(o => {
    const d = dateOnly(o.createdAt);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function summarize(orders: OrderResponse[]): SalesReportResponse {
  const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0);
  const totalCost = orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.costPrice * it.quantity, 0), 0);
  return {
    totalOrders: orders.length,
    totalRevenue,
    totalItems: orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.quantity, 0), 0),
    cashAmount: orders.filter(o => o.paymentType === 'CASH').reduce((s, o) => s + o.totalPrice, 0),
    cardAmount: orders.filter(o => o.paymentType === 'CARD').reduce((s, o) => s + o.totalPrice, 0),
    debtAmount: orders.filter(o => o.paymentType === 'DEBT').reduce((s, o) => s + o.totalPrice, 0),
    totalCost,
    totalProfit: totalRevenue - totalCost,
  };
}

// ── AUTH ────────────────────────────────────────────────────────────────────
export const mockAuthApi = {
  login: (body: { pin: string }): Promise<LoginResponse> => {
    const userMap: Record<string, LoginResponse> = {
      '0000': { token: 'mock-token-superadmin', role: 'SUPER_ADMIN', username: 'admin' },
      '1111': { token: 'mock-token-admin', role: 'ADMIN', username: 'doston' },
      '2222': { token: 'mock-token-kassir', role: 'KASSIR', username: 'kassir1' },
    };
    const match = userMap[body.pin];
    if (match) return delay(match);
    return Promise.reject(new Error('PIN noto\'g\'ri. Demo uchun: 0000, 1111, yoki 2222'));
  },
};

// ── USERS ───────────────────────────────────────────────────────────────────
export const mockUsersApi = {
  getAll: (page = 0, size = 20) => delay(paginate([...MOCK_USERS], page, size)),
  getById: (id: number) => delay(MOCK_USERS.find(u => u.id === id)!),
  create: (body: { username: string; pin: string; role: string }) => {
    const u: UserResponse = { id: MOCK_USERS.length + 1, username: body.username, role: body.role, active: true, createdAt: new Date().toISOString() };
    MOCK_USERS.push(u);
    return delay(u);
  },
  update: (id: number, body: { username: string; pin: string; role: string }) => {
    const idx = MOCK_USERS.findIndex(u => u.id === id);
    if (idx >= 0) { MOCK_USERS[idx] = { ...MOCK_USERS[idx], username: body.username, role: body.role }; }
    return delay(MOCK_USERS[idx]);
  },
  delete: (id: number) => { const idx = MOCK_USERS.findIndex(u => u.id === id); if (idx >= 0) MOCK_USERS.splice(idx, 1); return delay(undefined); },
  toggleStatus: (id: number, active: boolean) => {
    const idx = MOCK_USERS.findIndex(u => u.id === id);
    if (idx >= 0) MOCK_USERS[idx].active = active;
    return delay(MOCK_USERS[idx]);
  },
};

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
export const mockProductsApi = {
  getAll: (search?: string, page = 0, size = 30) => {
    let list = [...mockProducts];
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));
    return delay(paginate(list, page, size));
  },
  getById: (id: number) => delay(mockProducts.find(p => p.id === id)!),
  getByBarcode: (barcode: string) => delay(mockProducts.find(p => p.barcode === barcode)!),
  create: (body: Omit<ProductResponse, 'id' | 'createdAt'>) => {
    const p: ProductResponse = { ...body, id: nextProductId++, createdAt: new Date().toISOString() };
    mockProducts.push(p);
    return delay(p);
  },
  update: (id: number, body: Omit<ProductResponse, 'id' | 'createdAt'>) => {
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx >= 0) mockProducts[idx] = { ...mockProducts[idx], ...body };
    return delay(mockProducts[idx]);
  },
  delete: (id: number) => { mockProducts = mockProducts.filter(p => p.id !== id); return delay(undefined); },
  restock: (id: number, body: { quantity: number; note?: string }) => {
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx >= 0) {
      mockProducts[idx].quantity += body.quantity;
      mockMovements.push({ id: nextMovementId++, productName: mockProducts[idx].name, type: 'IN', quantity: body.quantity, note: body.note, createdAt: new Date().toISOString() });
    }
    return delay(mockProducts[idx]);
  },
  createOutflow: (id: number, body: { quantity: number; reason: string }) => {
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx >= 0) {
      mockProducts[idx].quantity = Math.max(0, mockProducts[idx].quantity - body.quantity);
      mockMovements.push({ id: nextMovementId++, productName: mockProducts[idx].name, type: 'OUT', quantity: body.quantity, note: body.reason, createdAt: new Date().toISOString() });
    }
    return delay({ id, productName: mockProducts[idx]?.name ?? '', quantity: body.quantity, reason: body.reason, createdAt: new Date().toISOString() });
  },
  receive: (body: { barcode: string; name?: string; quantity: number; price?: number; costPrice?: number; unit?: string }) => {
    const existing = mockProducts.find(p => p.barcode === body.barcode);
    if (existing) {
      existing.quantity += body.quantity;
      mockMovements.push({ id: nextMovementId++, productName: existing.name, type: 'IN', quantity: body.quantity, note: 'Qabul qilindi', createdAt: new Date().toISOString() });
      return delay(existing);
    }
    const p: ProductResponse = {
      id: nextProductId++, name: body.name ?? body.barcode, barcode: body.barcode,
      price: body.price ?? 0, costPrice: body.costPrice ?? 0, quantity: body.quantity,
      unit: body.unit ?? 'dona', minQuantity: 0, createdAt: new Date().toISOString(),
    };
    mockProducts.push(p);
    mockMovements.push({ id: nextMovementId++, productName: p.name, type: 'IN', quantity: body.quantity, note: 'Qabul qilindi', createdAt: new Date().toISOString() });
    return delay(p);
  },
  restockHistory: (id: number) => {
    const product = mockProducts.find(p => p.id === id);
    const history = mockMovements.filter(m => product && m.productName === product.name && (m.type === 'IN' || m.type === 'ADJUSTMENT'));
    return delay(history);
  },
};

// ── ORDERS ────────────────────────────────────────────────────────────────────
export const mockOrdersApi = {
  getAll: (page = 0, size = 20) => delay(paginate([...mockOrders].reverse(), page, size)),
  create: (body: { items: { productId: number; quantity: number }[]; paymentType: string; customerName?: string; customerPhone?: string }) => {
    let total = 0;
    const items: OrderItemResponse[] = body.items.map(it => {
      const product = mockProducts.find(p => p.id === it.productId);
      const price = product?.price ?? 0;
      const costPrice = product?.costPrice ?? 0;
      total += price * it.quantity;
      if (product) {
        product.quantity = Math.max(0, product.quantity - it.quantity);
        mockMovements.push({ id: nextMovementId++, productName: product.name, type: 'SALE', quantity: it.quantity, note: 'Sotildi', createdAt: new Date().toISOString() });
      }
      return { productId: it.productId, productName: product?.name ?? `#${it.productId}`, quantity: it.quantity, price, costPrice };
    });
    const order: OrderResponse = {
      id: nextOrderId++, items, totalPrice: total,
      paymentType: body.paymentType, cashierName: 'admin',
      customerName: body.customerName, customerPhone: body.customerPhone,
      createdAt: new Date().toISOString(),
    };
    mockOrders.push(order);
    if (body.paymentType === 'DEBT' && body.customerName && body.customerPhone) {
      const d: DebtResponse = {
        id: nextDebtId++, customerName: body.customerName, customerPhone: body.customerPhone,
        amount: total, paidAmount: 0, remainingAmount: total, status: 'UNPAID',
        description: `Buyurtma #${order.id}`, createdAt: order.createdAt,
      };
      mockDebts.push(d);
    }
    return delay(order);
  },
};

// ── DEBTS ─────────────────────────────────────────────────────────────────────
export const mockDebtsApi = {
  getAll: (page = 0, size = 20) => delay(paginate([...mockDebts].reverse(), page, size)),
  create: (body: { customerName: string; customerPhone: string; amount: number; description?: string }) => {
    const d: DebtResponse = { id: nextDebtId++, ...body, paidAmount: 0, remainingAmount: body.amount, status: 'UNPAID', createdAt: new Date().toISOString() };
    mockDebts.push(d);
    return delay(d);
  },
  update: (id: number, body: { customerName: string; customerPhone: string; amount: number; description?: string }) => {
    const idx = mockDebts.findIndex(d => d.id === id);
    if (idx >= 0) {
      mockDebts[idx] = { ...mockDebts[idx], ...body, remainingAmount: body.amount - mockDebts[idx].paidAmount };
    }
    return delay(mockDebts[idx]);
  },
  delete: (id: number) => { mockDebts = mockDebts.filter(d => d.id !== id); return delay(undefined); },
  pay: (id: number, body: { amount: number }) => {
    const idx = mockDebts.findIndex(d => d.id === id);
    if (idx >= 0) {
      const d = mockDebts[idx];
      d.paidAmount = Math.min(d.amount, d.paidAmount + body.amount);
      d.remainingAmount = d.amount - d.paidAmount;
      d.status = d.remainingAmount === 0 ? 'PAID' : 'PARTIAL';
      const payments = mockDebtPayments[id] ?? (mockDebtPayments[id] = []);
      payments.push({ id: nextPaymentId++, amount: body.amount, createdAt: new Date().toISOString() });
    }
    return delay(mockDebts[idx]);
  },
  getPayments: (id: number) => delay([...(mockDebtPayments[id] ?? [])].reverse()),
};

// ── STOCK MOVEMENTS ───────────────────────────────────────────────────────────
export const mockStockMovementsApi = {
  getAll: (params?: { from?: string; to?: string; type?: string; page?: number; size?: number }) => {
    let list = [...mockMovements].reverse();
    if (params?.type) list = list.filter(m => m.type === params.type);
    if (params?.from) list = list.filter(m => m.createdAt >= params.from!);
    if (params?.to) list = list.filter(m => m.createdAt <= params.to!);
    return delay(paginate(list, params?.page ?? 0, params?.size ?? 20));
  },
};

// ── REPORTS ───────────────────────────────────────────────────────────────────
export const mockReportsApi = {
  daily: (date?: string): Promise<SalesReportResponse> => {
    const target = date ?? todayDateOnly();
    return delay(summarize(ordersInRange(target, target)));
  },
  range: (from: string, to: string): Promise<SalesReportResponse> => {
    return delay(summarize(ordersInRange(from, to)));
  },
  rangeDaily: (from: string, to: string): Promise<DailySalesResponse[]> => {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const days: DailySalesResponse[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOrders = ordersInRange(dateStr, dateStr);
      const s = summarize(dayOrders);
      days.push({ date: dateStr, totalOrders: s.totalOrders, totalRevenue: s.totalRevenue, totalProfit: s.totalProfit });
    }
    return delay(days);
  },
  byUser: (from: string, to: string): Promise<UserSalesResponse[]> => {
    const orders = ordersInRange(from, to);
    const byUser = new Map<string, UserSalesResponse>();
    for (const o of orders) {
      const cur = byUser.get(o.cashierName) ?? { username: o.cashierName, totalOrders: 0, totalRevenue: 0 };
      cur.totalOrders += 1;
      cur.totalRevenue += o.totalPrice;
      byUser.set(o.cashierName, cur);
    }
    return delay([...byUser.values()].sort((a, b) => b.totalRevenue - a.totalRevenue));
  },
  profitByProduct: (from: string, to: string): Promise<ProfitByProductResponse[]> => {
    const orders = ordersInRange(from, to);
    const byProduct = new Map<number, ProfitByProductResponse>();
    for (const o of orders) {
      for (const it of o.items) {
        const cur = byProduct.get(it.productId) ?? {
          productId: it.productId, productName: it.productName, quantitySold: 0,
          revenue: 0, cost: 0, profit: 0, marginPct: 0,
        };
        cur.quantitySold += it.quantity;
        cur.revenue += it.price * it.quantity;
        cur.cost += it.costPrice * it.quantity;
        cur.profit = cur.revenue - cur.cost;
        cur.marginPct = cur.revenue > 0 ? Math.round((cur.profit / cur.revenue) * 1000) / 10 : 0;
        byProduct.set(it.productId, cur);
      }
    }
    return delay([...byProduct.values()].sort((a, b) => b.profit - a.profit));
  },
  inventorySummary: (): Promise<InventorySummaryResponse> => {
    return delay({
      totalProducts: mockProducts.length,
      lowStockCount: mockProducts.filter(p => p.quantity <= p.minQuantity).length,
      inventoryValue: mockProducts.reduce((s, p) => s + p.price * p.quantity, 0),
      inventoryCost: mockProducts.reduce((s, p) => s + p.costPrice * p.quantity, 0),
    });
  },
  exportCsv: () => '#',
};

// ── SMS ───────────────────────────────────────────────────────────────────────
export const mockSmsApi = {
  getCampaigns: () => delay([...mockCampaigns].reverse()),
  sendSms: (body: { message: string; phones: string[]; campaignName?: string }) => {
    const c: SmsCampaignResponse = { id: nextCampaignId++, campaignName: body.campaignName, message: body.message, phones: body.phones, delivered: true, createdAt: new Date().toISOString() };
    mockCampaigns.push(c);
    return delay(c);
  },
  getBalance: (): Promise<SmsBalanceResponse> => delay({ balance: 24500, currency: 'UZS' }),
};

// ── SETTINGS ──────────────────────────────────────────────────────────────────
let mockSettings = { ...MOCK_SETTINGS };
export const mockSettingsApi = {
  get: () => delay({ ...mockSettings }),
  update: (body: SettingsResponse) => { mockSettings = { ...mockSettings, ...body }; return delay({ ...mockSettings }); },
};
