// In-memory stand-in for the "Orders Doston API" (VITE_USE_MOCK=true).
//
// Every export here is structurally assignable to its real counterpart in
// ./api.ts — same argument lists, same response shapes. If the server cannot
// supply a value, this file does not invent one either: a mock that is richer
// than the API would let a screen render data that dies in production.
import type {
  BarcodeLookupResponse, DailySalesResponse, DebtPaymentResponse, DebtPayRequest,
  DebtRequest, DebtResponse,
  LoginResponse, MeResponse, OrderItemResponse, OrderRequest, OrderResponse,
  OutflowReason, OutflowRequest, OutflowResponse,
  PagedResponse, PaymentMethod,
  ProductRequest, ProductResponse, ProductSalesResponse, RestockRequest, SalesReportResponse,
  SettingsRequest, SettingsResponse, SmsBalanceResponse, SmsCampaignResponse, SmsSendRequest,
  StockMovementResponse,
  UserRequest, UserUpdateRequest, UserResponse, UserSalesResponse,
} from './api';

// Mirrors LOW_STOCK_THRESHOLD in api.ts. Kept as a local literal on purpose:
// importing a *value* from api.ts would close a runtime import cycle.
const LOW_STOCK = 5;

// ── Date helpers (everything is relative to "today" so the demo always looks live) ──
// LOCAL calendar dates, not UTC: the app sends local date strings (utils
// todayStr), and a sale rung up at 00:30 local must land on today's report —
// slicing toISOString() put it on yesterday-UTC between midnight and 05:00.
function daysAgoISO(n: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function dateOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayDateOnly(): string {
  return dateOnly(new Date().toISOString());
}

function paginate<T>(items: T[], page: number, size: number): PagedResponse<T> {
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = page * size;
  return {
    content: items.slice(start, start + size),
    page: { size, number: page, totalElements, totalPages },
  };
}

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

// ── Users ────────────────────────────────────────────────────────────────────
// Only two roles exist server-side: SUPER_ADMIN and CASHIER.
interface MockUser extends UserResponse { pin: string }

let mockUsers: MockUser[] = [
  { id: 1, pin: '0000', fullName: 'Doston Rahimov', role: 'SUPER_ADMIN', active: true },
  { id: 2, pin: '2222', fullName: 'Aziza Karimova', role: 'CASHIER', active: true },
  { id: 3, pin: '3333', fullName: 'Sardor Toshmatov', role: 'CASHIER', active: false },
];
let nextUserId = 4;

/** Strips the demo-only `pin` so callers get exactly a UserResponse. */
function toUserResponse(u: MockUser): UserResponse {
  return { id: u.id, fullName: u.fullName, role: u.role, active: u.active };
}

const SUPER_ADMIN_NAME = 'Doston Rahimov';
const CASHIER_NAME = 'Aziza Karimova';

// ── Products ─────────────────────────────────────────────────────────────────
// No `unit`, no `minQuantity`: "dona" is a UI word and low stock is decided by
// LOW_STOCK, exactly like GET /api/products/low-stock.
let mockProducts: ProductResponse[] = [
  { id: 1, name: 'Coca-Cola 0.5L', barcode: '4870201000014', purchasePrice: 5500, price: 8000, stockQuantity: 120 },
  { id: 2, name: 'Pepsi 1L', barcode: '4870201000021', purchasePrice: 8500, price: 12000, stockQuantity: 80 },
  { id: 3, name: 'Suv 1.5L', barcode: '4870201000038', purchasePrice: 2800, price: 4500, stockQuantity: 200 },
  { id: 4, name: 'Non (katta)', barcode: '4870201000045', purchasePrice: 4500, price: 7000, stockQuantity: 3 },
  { id: 5, name: 'Sut 1L', barcode: '4870201000052', purchasePrice: 10500, price: 14000, stockQuantity: 45 },
  { id: 6, name: "Yog' 1L", barcode: '4870201000069', purchasePrice: 22000, price: 28000, stockQuantity: 30 },
  { id: 7, name: 'Shakar 1kg', barcode: '4870201000076', purchasePrice: 15000, price: 18000, stockQuantity: 60 },
  { id: 8, name: 'Un 2kg', barcode: '4870201000083', purchasePrice: 17500, price: 22000, stockQuantity: 4 },
];
let nextProductId = 9;

/** Stands in for the external barcode catalogue (GET .../external-lookup). */
const EXTERNAL_CATALOGUE: Record<string, { name: string; brand: string }> = {
  '4870201000090': { name: 'Fanta 1L', brand: 'Coca-Cola' },
  '4870201000106': { name: "Choy (ko'k) 100g", brand: 'Ahmad Tea' },
  '4870201000113': { name: 'Guruch 1kg', brand: 'Laser' },
};

// ── Stock movements ──────────────────────────────────────────────────────────
// `productId` is mock-internal (the server's StockMovementResponse carries only
// the name): restock history must survive a product rename, and two same-named
// products must not share one history.
interface MockMovement extends StockMovementResponse { productId: number }

const mockMovements: MockMovement[] = [
  { id: 1, type: 'IN', productId: 1, productName: 'Coca-Cola 0.5L', quantity: 50, performedBy: SUPER_ADMIN_NAME, reason: 'Yangi partiya', createdAt: daysAgoISO(5, 8) },
  { id: 2, type: 'SALE', productId: 2, productName: 'Pepsi 1L', quantity: 5, performedBy: CASHIER_NAME, reason: 'Sotildi', createdAt: daysAgoISO(4, 10, 30) },
  { id: 3, type: 'OUT', productId: 4, productName: 'Non (katta)', quantity: 3, performedBy: CASHIER_NAME, reason: 'Buzilgan', createdAt: daysAgoISO(4, 14) },
  { id: 4, type: 'IN', productId: 3, productName: 'Suv 1.5L', quantity: 100, performedBy: SUPER_ADMIN_NAME, reason: "Ombor to'ldirish", createdAt: daysAgoISO(3, 9) },
  { id: 5, type: 'ADJUSTMENT', productId: 7, productName: 'Shakar 1kg', quantity: 2, performedBy: SUPER_ADMIN_NAME, reason: 'Inventarizatsiya', createdAt: daysAgoISO(2, 16) },
  { id: 6, type: 'SALE', productId: 5, productName: 'Sut 1L', quantity: 3, performedBy: CASHIER_NAME, reason: 'Sotildi', createdAt: daysAgoISO(1, 8, 30) },
];
let nextMovementId = 7;

const OUTFLOW_LABELS: Record<OutflowReason, string> = {
  DAMAGED: 'Buzilgan',
  LOST: "Yo'qolgan",
  RETURNED: 'Qaytarilgan',
};

// ── Orders ───────────────────────────────────────────────────────────────────
// OrderResponse carries no productId and no cashier, so the demo keeps those on
// a private record alongside it — reports need them, screens never see them.
interface MockOrder {
  order: OrderResponse;
  lines: { productId: number; quantity: number }[];
  userId: number;
}

function buildOrder(
  id: number, dayAgo: number, hour: number, minute: number,
  lines: [number, number][], paymentMethod: PaymentMethod, userId: number,
  discountAmount = 0,
): MockOrder {
  const items: OrderItemResponse[] = lines.map(([productId, quantity]) => {
    const p = mockProducts.find(pr => pr.id === productId)!;
    return {
      productName: p.name,
      quantity,
      unitPrice: p.price,
      profit: (p.price - p.purchasePrice) * quantity,
    };
  });
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  return {
    order: {
      id,
      subtotal,
      discountAmount,
      totalAmount: subtotal - discountAmount,
      createdAt: daysAgoISO(dayAgo, hour, minute),
      paymentMethod,
      items,
    },
    lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
    userId,
  };
}

const mockOrders: MockOrder[] = [
  buildOrder(1, 13, 9, 10, [[1, 4], [3, 2]], 'CASH', 1),
  buildOrder(2, 13, 15, 40, [[2, 2], [7, 1]], 'CARD', 2),
  buildOrder(3, 12, 10, 5, [[5, 2], [4, 3]], 'CASH', 2),
  buildOrder(4, 12, 17, 20, [[6, 1]], 'CARD', 2, 2000),
  buildOrder(5, 11, 9, 45, [[1, 6], [3, 4]], 'CASH', 1),
  buildOrder(6, 11, 13, 15, [[8, 2], [7, 1]], 'CREDIT', 2),
  buildOrder(7, 10, 11, 0, [[2, 3]], 'CARD', 2),
  buildOrder(8, 10, 16, 30, [[3, 5], [5, 1]], 'CASH', 1),
  buildOrder(9, 9, 9, 20, [[1, 2], [4, 1]], 'CASH', 2),
  buildOrder(10, 9, 14, 10, [[6, 1], [8, 1]], 'MIXED', 2),
  buildOrder(11, 8, 10, 50, [[7, 2]], 'CASH', 2),
  buildOrder(12, 8, 18, 5, [[1, 3], [2, 1]], 'CREDIT', 1),
  buildOrder(13, 7, 9, 30, [[3, 6], [1, 2]], 'CASH', 2, 1500),
  buildOrder(14, 7, 12, 45, [[5, 3]], 'CARD', 2),
  buildOrder(15, 6, 10, 15, [[4, 2], [7, 1]], 'CASH', 1),
  buildOrder(16, 6, 16, 0, [[2, 2], [8, 1]], 'CARD', 2),
  buildOrder(17, 5, 9, 10, [[1, 5], [3, 3]], 'CASH', 2),
  buildOrder(18, 5, 15, 20, [[6, 1], [7, 2]], 'CREDIT', 2),
  buildOrder(19, 4, 11, 30, [[3, 4], [5, 1]], 'CASH', 1),
  buildOrder(20, 4, 17, 40, [[2, 1], [1, 2]], 'CARD', 2),
  buildOrder(21, 3, 9, 25, [[4, 1], [8, 1]], 'MIXED', 2),
  buildOrder(22, 3, 14, 50, [[1, 4], [7, 1]], 'CARD', 1),
  buildOrder(23, 2, 10, 10, [[3, 3], [6, 1]], 'CASH', 2),
  buildOrder(24, 2, 16, 20, [[2, 2], [5, 1]], 'CREDIT', 2),
  buildOrder(25, 1, 9, 40, [[1, 3], [3, 2]], 'CASH', 2, 1000),
  buildOrder(26, 1, 13, 15, [[7, 1], [8, 1]], 'CARD', 1),
  buildOrder(27, 0, 8, 30, [[1, 2], [3, 1]], 'CASH', 1),
  buildOrder(28, 0, 9, 45, [[5, 1], [4, 2]], 'CARD', 2),
  buildOrder(29, 0, 10, 20, [[2, 1], [6, 1]], 'CASH', 2),
];
let nextOrderId = 30;

// ── Debts ────────────────────────────────────────────────────────────────────
// No `remainingAmount` field — callers derive it via remainingAmount(debt).
let mockDebts: DebtResponse[] = [
  { id: 1, customerName: 'Alisher Karimov', phone: '+998901112233', amount: 150000, paidAmount: 50000, status: 'PARTIAL', createdAt: daysAgoISO(40, 10) },
  { id: 2, customerName: 'Bobur Yusupov', phone: '+998901223344', amount: 85000, paidAmount: 85000, status: 'PAID', createdAt: daysAgoISO(25, 11, 30), orderId: 24 },
  { id: 3, customerName: 'Dilnoza Nazarova', phone: '+998901334455', amount: 200000, paidAmount: 0, status: 'UNPAID', createdAt: daysAgoISO(10, 9) },
  { id: 4, customerName: 'Eldor Toshmatov', phone: '+998901445566', amount: 50000, paidAmount: 20000, status: 'PARTIAL', createdAt: daysAgoISO(6, 14), orderId: 18 },
];
let nextDebtId = 5;

const mockDebtPayments: Record<number, DebtPaymentResponse[]> = {
  1: [{ id: 1, amount: 50000, performedBy: SUPER_ADMIN_NAME, createdAt: daysAgoISO(15, 12) }],
  2: [
    { id: 2, amount: 40000, performedBy: CASHIER_NAME, createdAt: daysAgoISO(20, 10) },
    { id: 3, amount: 45000, performedBy: SUPER_ADMIN_NAME, createdAt: daysAgoISO(9, 16, 30) },
  ],
  4: [{ id: 4, amount: 20000, performedBy: CASHIER_NAME, createdAt: daysAgoISO(2, 11) }],
};
let nextPaymentId = 5;

function debtStatus(amount: number, paidAmount: number): DebtResponse['status'] {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount >= amount) return 'PAID';
  return 'PARTIAL';
}

// ── SMS ──────────────────────────────────────────────────────────────────────
// The server stores recipients as one joined string; so does the mock.
const mockCampaigns: SmsCampaignResponse[] = [
  { id: 1, message: 'Bayram aksiyasi! Barcha ichimliklarga -20% chegirma.', recipients: '+998901112233, +998901223344', createdAt: daysAgoISO(22, 10), smsCount: 2, delivered: true },
  { id: 2, message: 'Yangi mahsulotlar keldi. Bugun tashrif buyuring!', recipients: '+998901334455', createdAt: daysAgoISO(11, 14, 30), smsCount: 1, delivered: true },
];
let nextCampaignId = 3;

// ── Settings ─────────────────────────────────────────────────────────────────
// Only language + darkMode exist. Store name, currency, tax rate and monthly
// target are not part of the API and are deliberately absent.
let mockSettings: SettingsResponse = { id: 1, language: 'uz', darkMode: false };

// ── AUTH ─────────────────────────────────────────────────────────────────────
const TOKEN_PREFIX = 'mock-token-';

export const mockAuthApi = {
  login: (body: { pin: string }): Promise<LoginResponse> => {
    const user = mockUsers.find(u => u.pin === body.pin && u.active);
    if (!user) {
      return Promise.reject(new Error("PIN noto'g'ri. Demo uchun: 0000 yoki 2222"));
    }
    return delay<LoginResponse>({
      id: user.id,
      token: `${TOKEN_PREFIX}${user.id}`,
      fullName: user.fullName,
      role: user.role,
    });
  },
  me: (): Promise<MeResponse> => {
    const token = localStorage.getItem('token') ?? '';
    const id = Number(token.replace(TOKEN_PREFIX, ''));
    const user = mockUsers.find(u => u.id === id && u.active);
    if (!user) return Promise.reject(new Error('Sessiya tugadi. Iltimos qayta kiring.'));
    return delay<MeResponse>({ id: user.id, fullName: user.fullName, role: user.role });
  },
};

// ── USERS ────────────────────────────────────────────────────────────────────
export const mockUsersApi = {
  getAll: (page = 0, size = 20): Promise<PagedResponse<UserResponse>> =>
    delay(paginate(mockUsers.map(toUserResponse), page, size)),
  getById: (id: number): Promise<UserResponse> => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) return Promise.reject(new Error("Ma'lumot topilmadi."));
    return delay(toUserResponse(user));
  },
  create: (body: UserRequest): Promise<UserResponse> => {
    // The real POST /api/users answers 400 "PIN band" for a taken PIN — and a
    // duplicate here would leave the new user unable to log in anyway, since
    // login matches the first user with that PIN.
    if (mockUsers.some(u => u.pin === body.pin)) {
      return Promise.reject(new Error('PIN band'));
    }
    const user: MockUser = {
      id: nextUserId++, pin: body.pin, fullName: body.fullName, role: body.role, active: true,
    };
    mockUsers.push(user);
    return delay(toUserResponse(user));
  },
  update: (id: number, body: UserUpdateRequest): Promise<UserResponse> => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) return Promise.reject(new Error("Ma'lumot topilmadi."));
    if (body.pin && mockUsers.some(u => u.pin === body.pin && u.id !== id)) {
      return Promise.reject(new Error('PIN band'));
    }
    // An omitted PIN keeps the current one — same as UserUpdateRequest allows.
    if (body.pin) user.pin = body.pin;
    user.fullName = body.fullName;
    user.role = body.role;
    return delay(toUserResponse(user));
  },
  delete: (id: number): Promise<void> => {
    mockUsers = mockUsers.filter(u => u.id !== id);
    return delay(undefined);
  },
  toggleStatus: (id: number, active: boolean): Promise<UserResponse> => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) return Promise.reject(new Error("Ma'lumot topilmadi."));
    user.active = active;
    return delay(toUserResponse(user));
  },
};

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
function recordMovement(
  type: StockMovementResponse['type'], product: ProductResponse, quantity: number, reason?: string,
): void {
  mockMovements.push({
    id: nextMovementId++,
    type,
    productId: product.id,
    productName: product.name,
    quantity,
    performedBy: SUPER_ADMIN_NAME,
    reason,
    createdAt: new Date().toISOString(),
  });
}

let nextOutflowId = 1;

export const mockProductsApi = {
  getAll: (search?: string, page = 0, size = 30): Promise<PagedResponse<ProductResponse>> => {
    let list = [...mockProducts];
    if (search) {
      // Name only — the real `search` param matches the name, not the barcode
      // (openapi: "Qidiruv so'zi (mahsulot nomi)"). Matching barcodes here made
      // digit searches work in demo and come back empty in production.
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return delay(paginate(list, page, size));
  },
  getById: (id: number): Promise<ProductResponse> => {
    const product = mockProducts.find(p => p.id === id);
    if (!product) return Promise.reject(new Error('Mahsulot topilmadi.'));
    return delay({ ...product });
  },
  getByBarcode: (barcode: string): Promise<ProductResponse> => {
    const product = mockProducts.find(p => p.barcode === barcode);
    if (!product) return Promise.reject(new Error('Mahsulot topilmadi.'));
    return delay({ ...product });
  },
  externalLookup: (barcode: string): Promise<BarcodeLookupResponse> => {
    const hit = EXTERNAL_CATALOGUE[barcode];
    if (!hit) return delay<BarcodeLookupResponse>({ barcode, found: false });
    return delay<BarcodeLookupResponse>({ barcode, found: true, name: hit.name, brand: hit.brand });
  },
  lowStock: (threshold = LOW_STOCK, page = 0, size = 30): Promise<PagedResponse<ProductResponse>> => {
    const list = mockProducts
      .filter(p => p.stockQuantity <= threshold)
      .sort((a, b) => a.stockQuantity - b.stockQuantity);
    return delay(paginate(list, page, size));
  },
  create: (body: ProductRequest): Promise<ProductResponse> => {
    const product: ProductResponse = { id: nextProductId++, ...body };
    mockProducts.push(product);
    return delay({ ...product });
  },
  update: (id: number, body: ProductRequest): Promise<ProductResponse> => {
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx < 0) return Promise.reject(new Error('Mahsulot topilmadi.'));
    mockProducts[idx] = { ...mockProducts[idx], ...body };
    return delay({ ...mockProducts[idx] });
  },
  delete: (id: number): Promise<void> => {
    mockProducts = mockProducts.filter(p => p.id !== id);
    return delay(undefined);
  },
  restock: (id: number, body: RestockRequest): Promise<ProductResponse> => {
    const product = mockProducts.find(p => p.id === id);
    if (!product) return Promise.reject(new Error('Mahsulot topilmadi.'));
    if (body.quantity <= 0) return Promise.reject(new Error("Miqdor 0 dan katta bo'lishi kerak."));
    product.stockQuantity += body.quantity;
    recordMovement('IN', product, body.quantity, "Qayta to'ldirish");
    return delay({ ...product });
  },
  createOutflow: (id: number, body: OutflowRequest): Promise<OutflowResponse> => {
    const product = mockProducts.find(p => p.id === id);
    if (!product) return Promise.reject(new Error('Mahsulot topilmadi.'));
    if (body.quantity <= 0) return Promise.reject(new Error("Miqdor 0 dan katta bo'lishi kerak."));
    if (body.quantity > product.stockQuantity) {
      return Promise.reject(new Error('Ombordagi qoldiq yetarli emas'));
    }
    product.stockQuantity -= body.quantity;
    recordMovement('OUT', product, body.quantity, OUTFLOW_LABELS[body.reason]);
    return delay<OutflowResponse>({
      id: nextOutflowId++,
      productName: product.name,
      quantity: body.quantity,
      reason: body.reason,
      note: body.note,
      createdAt: new Date().toISOString(),
    });
  },
  restockHistory: (id: number): Promise<StockMovementResponse[]> => {
    const history = mockMovements
      .filter(m => m.productId === id && (m.type === 'IN' || m.type === 'ADJUSTMENT'))
      .reverse();
    return delay(history);
  },
};

// ── ORDERS ───────────────────────────────────────────────────────────────────
export const mockOrdersApi = {
  getAll: (page = 0, size = 20): Promise<PagedResponse<OrderResponse>> =>
    delay(paginate([...mockOrders].reverse().map(m => m.order), page, size)),
  getById: (id: number): Promise<OrderResponse> => {
    const found = mockOrders.find(m => m.order.id === id);
    if (!found) return Promise.reject(new Error("Ma'lumot topilmadi."));
    return delay({ ...found.order });
  },
  create: (body: OrderRequest): Promise<OrderResponse> => {
    // Summed per product, not only checked per line: two lines of the same
    // product each within stock could together overdraw it below zero.
    if (body.items.some(it => it.quantity <= 0)) {
      return Promise.reject(new Error('Ombordagi qoldiq yetarli emas'));
    }
    const wanted = new Map<number, number>();
    for (const it of body.items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.quantity);
    const unavailable = [...wanted].find(([productId, qty]) => {
      const product = mockProducts.find(p => p.id === productId);
      return !product || qty > product.stockQuantity;
    });
    if (unavailable) return Promise.reject(new Error('Ombordagi qoldiq yetarli emas'));

    const items: OrderItemResponse[] = body.items.map(it => {
      const product = mockProducts.find(p => p.id === it.productId)!;
      product.stockQuantity -= it.quantity;
      recordMovement('SALE', product, it.quantity, 'Sotildi');
      return {
        productName: product.name,
        quantity: it.quantity,
        unitPrice: product.price,
        profit: (product.price - product.purchasePrice) * it.quantity,
      };
    });

    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const discountAmount = body.discountAmount ?? 0;
    const order: OrderResponse = {
      id: nextOrderId++,
      subtotal,
      discountAmount,
      totalAmount: subtotal - discountAmount,
      createdAt: new Date().toISOString(),
      paymentMethod: body.paymentMethod,
      items,
    };
    mockOrders.push({
      order,
      lines: body.items.map(it => ({ productId: it.productId, quantity: it.quantity })),
      userId: 1,
    });

    // "Qarzga" sale — the server opens a debt for the unpaid remainder.
    if (body.paymentMethod === 'CREDIT' && body.customerName) {
      const paidAmount = Math.min(body.paidAmount ?? 0, order.totalAmount);
      mockDebts.push({
        id: nextDebtId++,
        customerName: body.customerName,
        phone: body.customerPhone,
        amount: order.totalAmount,
        paidAmount,
        status: debtStatus(order.totalAmount, paidAmount),
        createdAt: order.createdAt,
        orderId: order.id,
      });
    }
    return delay({ ...order });
  },
};

// ── DEBTS ────────────────────────────────────────────────────────────────────
export const mockDebtsApi = {
  getAll: (page = 0, size = 20): Promise<PagedResponse<DebtResponse>> =>
    delay(paginate([...mockDebts].reverse(), page, size)),
  create: (body: DebtRequest): Promise<DebtResponse> => {
    const debt: DebtResponse = {
      id: nextDebtId++,
      customerName: body.customerName,
      phone: body.phone,
      amount: body.amount,
      paidAmount: 0,
      status: 'UNPAID',
      createdAt: new Date().toISOString(),
      orderId: body.orderId,
    };
    mockDebts.push(debt);
    return delay({ ...debt });
  },
  update: (id: number, body: DebtRequest): Promise<DebtResponse> => {
    const debt = mockDebts.find(d => d.id === id);
    if (!debt) return Promise.reject(new Error("Ma'lumot topilmadi."));
    debt.customerName = body.customerName;
    debt.phone = body.phone;
    debt.amount = body.amount;
    debt.orderId = body.orderId;
    debt.status = debtStatus(debt.amount, debt.paidAmount);
    return delay({ ...debt });
  },
  delete: (id: number): Promise<void> => {
    mockDebts = mockDebts.filter(d => d.id !== id);
    return delay(undefined);
  },
  pay: (id: number, body: DebtPayRequest): Promise<DebtResponse> => {
    const debt = mockDebts.find(d => d.id === id);
    if (!debt) return Promise.reject(new Error("Ma'lumot topilmadi."));
    if (body.amount <= 0) return Promise.reject(new Error("Summa 0 dan katta bo'lishi kerak."));
    const remaining = debt.amount - debt.paidAmount;
    if (remaining <= 0) return Promise.reject(new Error("Qarz allaqachon to'langan."));
    // The ledger records what was actually applied — recording the raw amount
    // while clamping paidAmount let the payment history sum past the debt.
    const applied = Math.min(body.amount, remaining);
    debt.paidAmount += applied;
    debt.status = debtStatus(debt.amount, debt.paidAmount);
    const payments = mockDebtPayments[id] ?? (mockDebtPayments[id] = []);
    payments.push({
      id: nextPaymentId++,
      amount: applied,
      performedBy: SUPER_ADMIN_NAME,
      createdAt: new Date().toISOString(),
    });
    return delay({ ...debt });
  },
  getPayments: (id: number): Promise<DebtPaymentResponse[]> =>
    delay([...(mockDebtPayments[id] ?? [])].reverse()),
};

// ── STOCK MOVEMENTS ──────────────────────────────────────────────────────────
export const mockStockMovementsApi = {
  getAll: (params?: { from?: string; to?: string; type?: string; page?: number; size?: number }) => {
    let list = [...mockMovements].reverse();
    if (params?.type) list = list.filter(m => m.type === params.type);
    // Callers pass datetimes ("...T00:00:00"); compare date-to-date, or the
    // start day itself fails the >= check against its own midnight string.
    if (params?.from) {
      const from = params.from.slice(0, 10);
      list = list.filter(m => dateOnly(m.createdAt) >= from);
    }
    if (params?.to) {
      const to = params.to.slice(0, 10);
      list = list.filter(m => dateOnly(m.createdAt) <= to);
    }
    return delay(paginate(list, params?.page ?? 0, params?.size ?? 20));
  },
};

// ── REPORTS ──────────────────────────────────────────────────────────────────
function ordersInRange(from?: string, to?: string): MockOrder[] {
  return mockOrders.filter(m => {
    const d = dateOnly(m.order.createdAt);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function orderProfit(o: OrderResponse): number {
  return o.items.reduce((s, it) => s + it.profit, 0) - o.discountAmount;
}

function topProductsOf(records: MockOrder[]): ProductSalesResponse[] {
  const byProduct = new Map<number, ProductSalesResponse>();
  for (const rec of records) {
    for (const line of rec.lines) {
      const product = mockProducts.find(p => p.id === line.productId);
      const entry = byProduct.get(line.productId) ?? {
        productId: line.productId,
        productName: product?.name ?? `#${line.productId}`,
        quantitySold: 0,
      };
      entry.quantitySold += line.quantity;
      byProduct.set(line.productId, entry);
    }
  }
  return [...byProduct.values()]
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5);
}

/** Revenue, profit and credit sales — the only three totals the server reports. */
function summarize(from: string, to: string, records: MockOrder[]): SalesReportResponse {
  const orders = records.map(r => r.order);
  return {
    from,
    to,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + o.totalAmount, 0),
    totalProfit: orders.reduce((s, o) => s + orderProfit(o), 0),
    creditSalesAmount: orders
      .filter(o => o.paymentMethod === 'CREDIT')
      .reduce((s, o) => s + o.totalAmount, 0),
    topProducts: topProductsOf(records),
  };
}

export const mockReportsApi = {
  daily: (date?: string): Promise<SalesReportResponse> => {
    const target = date ?? todayDateOnly();
    return delay(summarize(target, target, ordersInRange(target, target)));
  },
  range: (from: string, to: string): Promise<SalesReportResponse> =>
    delay(summarize(from, to, ordersInRange(from, to))),
  rangeDaily: (from: string, to: string): Promise<DailySalesResponse[]> => {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const days: DailySalesResponse[] = [];
    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const s = summarize(date, date, ordersInRange(date, date));
      days.push({
        date,
        totalOrders: s.totalOrders,
        totalRevenue: s.totalRevenue,
        totalProfit: s.totalProfit,
        creditSalesAmount: s.creditSalesAmount,
      });
    }
    return delay(days);
  },
  byUser: (from: string, to: string): Promise<UserSalesResponse[]> => {
    const byUser = new Map<number, UserSalesResponse>();
    for (const rec of ordersInRange(from, to)) {
      const user = mockUsers.find(u => u.id === rec.userId);
      const entry = byUser.get(rec.userId) ?? {
        userId: rec.userId,
        fullName: user?.fullName ?? `#${rec.userId}`,
        role: user?.role ?? 'CASHIER',
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
      };
      entry.totalOrders += 1;
      entry.totalRevenue += rec.order.totalAmount;
      entry.totalProfit += orderProfit(rec.order);
      byUser.set(rec.userId, entry);
    }
    return delay([...byUser.values()].sort((a, b) => b.totalRevenue - a.totalRevenue));
  },
  exportCsv: (from: string, to: string): string => `#mock-export-${from}-${to}`,
};

// ── SMS ──────────────────────────────────────────────────────────────────────
export const mockSmsApi = {
  getCampaigns: (page = 0, size = 20): Promise<PagedResponse<SmsCampaignResponse>> =>
    delay(paginate([...mockCampaigns].reverse(), page, size)),
  sendSms: (body: SmsSendRequest): Promise<SmsCampaignResponse> => {
    const recipients = body.recipients.map(r => r.trim()).filter(Boolean);
    if (recipients.length === 0) {
      return Promise.reject(new Error("Kamida bitta raqam kiriting."));
    }
    const campaign: SmsCampaignResponse = {
      id: nextCampaignId++,
      message: body.message,
      recipients: recipients.join(', '),
      createdAt: new Date().toISOString(),
      smsCount: recipients.length * Math.max(1, Math.ceil(body.message.length / 160)),
      delivered: true,
    };
    mockCampaigns.push(campaign);
    return delay({ ...campaign });
  },
  getBalance: (): Promise<SmsBalanceResponse> => delay({ balance: 24500, mock: true }),
};

// ── SETTINGS ─────────────────────────────────────────────────────────────────
export const mockSettingsApi = {
  get: (): Promise<SettingsResponse> => delay({ ...mockSettings }),
  update: (body: SettingsRequest): Promise<SettingsResponse> => {
    mockSettings = { ...mockSettings, language: body.language, darkMode: body.darkMode };
    return delay({ ...mockSettings });
  },
};
