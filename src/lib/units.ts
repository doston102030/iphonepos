// The server's product record has no unit field (docs/openapi.json:
// ProductRequest/ProductResponse stop at stockQuantity), so the shop's measure
// words live on this device: a localStorage map of productId → unit. It is a
// display word only — quantities stay whole numbers and the server never sees
// it. On another device the same product simply falls back to "dona".

export const UNITS = ['dona', 'kg', 'gramm', 'litr', 'ml', 'quti', 'pachka'] as const;
export type Unit = (typeof UNITS)[number];
export const DEFAULT_UNIT: Unit = 'dona';

/** How each unit reads in a picker: the word itself, capitalized where usual. */
export const UNIT_LABELS: Record<Unit, string> = {
  dona: 'Dona',
  kg: 'Kg',
  gramm: 'Gramm',
  litr: 'Litr',
  ml: 'ml',
  quti: 'Quti',
  pachka: 'Pachka',
};

const STORAGE_KEY = 'inpos.productUnits';

// Parsed once and kept — product lists call getProductUnit per row, and
// re-reading localStorage JSON for every row of every render adds up.
let cache: Record<string, Unit> | null = null;

function readMap(): Record<string, Unit> {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, Unit>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getProductUnit(productId: number): Unit {
  const unit = readMap()[String(productId)];
  return UNITS.includes(unit) ? unit : DEFAULT_UNIT;
}

export function setProductUnit(productId: number, unit: Unit): void {
  const map = readMap();
  // The default is not stored: a product with no entry already reads "dona",
  // and this keeps the map from growing with every product ever created.
  if (unit === DEFAULT_UNIT) delete map[String(productId)];
  else map[String(productId)] = unit;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / full storage: the unit still applies until reload.
  }
}
