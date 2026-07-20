/**
 * Turns a scanned barcode into a product name by asking the big open product
 * databases — all of them at once, first good answer wins.
 *
 * Five sources are queried in parallel: the four Open*Facts families (food,
 * beauty, household, pet food — one shared API, CORS open to everyone) and
 * UPCitemdb (CORS closed, reached through the /ext/upc proxy that vite serves
 * in dev and a vercel.json rewrite serves in prod). The slow ones are not
 * waited for: the first source to produce a FULL name resolves the lookup.
 * A "thin" name — just a brand like "FOGG", no size, one or two words — only
 * wins if nobody produces anything better.
 *
 * Local Uzbek/CIS goods are often missing from all five; that is fine — the
 * name is typed once by hand and comes from our own base ever after.
 */

const TIMEOUT_MS = 8000;

const OFF_HOSTS = [
  'https://world.openfoodfacts.org',
  'https://world.openbeautyfacts.org',
  'https://world.openproductsfacts.org',
  'https://world.openpetfoodfacts.org',
];

interface OffProduct { product_name?: string; brands?: string; quantity?: string }
interface OffResponse { status?: number; product?: OffProduct }
interface UpcResponse { items?: { title?: string }[] }

function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal })
    .then(res => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

/** "1 dona"-style names don't help a cashier; size or ≥2 real words do. */
const SIZE_RE = /\d+\s*(ml|l|ltr|litr|g|gr|kg|mg|oz|dona|sht|шт|мл|л|г|кг)\b/i;

function isThinName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  return words.length <= 2 && !SIZE_RE.test(name);
}

/** UPCitemdb sometimes writes the EAN into the title itself
 * ("7590002031636 1 ltr Shampoo…"). The code already lives in its own field,
 * so the scanned code — and any standalone 8+ digit run, which can only be a
 * barcode, never a size — is noise, not name. */
function stripCodes(raw: string, code?: string): string {
  let name = raw;
  if (code) name = name.split(code).join(' ');
  return name.replace(/\b\d{8,}\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A standalone size token: "1ltr", "0.5l", "120ml", "1.5kg"… */
const SIZE_TOKEN_RE = /^\d+(?:[.,]\d+)?(ml|l|ltr|g|gr|kg|mg|oz|мл|л|г|кг)$/i;

/** Words a name must not END on after being shortened. */
const CONNECTORS = new Set(['with', 'for', 'and', 'of', 'the', 'in', 'для', 'с', 'и', 'в']);

/**
 * Tidy a database name for a POS card: drop stray barcodes, glue "120 ml" →
 * "120ml", move the size token to the tail, and keep whole words up to a card
 * line (~26 chars) — catalogue titles arrive as marketing sentences
 * ("1 ltr Shampoo for Men Old Spice with Pump") and a till card wants
 * "Shampoo for Men Old Spice 1ltr", not the sentence.
 */
export function cleanProductName(raw: string, code?: string): string {
  let name = stripCodes(raw, code);
  // Lookahead, not \b: word boundaries are ASCII-only, so "250 мл" never glued.
  name = name.replace(/(\d+(?:[.,]\d+)?)\s+(ml|l|ltr|g|gr|kg|mg|oz|мл|л|г|кг)(?=[\s.,;)]|$)/gi, '$1$2');

  const words = name.split(' ').filter(Boolean);
  const sizeIdx = words.findIndex(w => SIZE_TOKEN_RE.test(w));
  const size = sizeIdx >= 0 ? words.splice(sizeIdx, 1)[0] : '';

  // Whole words only — the old fixed slice cut mid-word ("Old Spic").
  const kept: string[] = [];
  for (const w of words) {
    if (kept.join(' ').length + (kept.length ? 1 : 0) + w.length > 26) break;
    kept.push(w);
  }
  // > 0, not > 1: a name reduced to a single connector ("with") is junk too.
  while (kept.length > 0 && CONNECTORS.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  if (kept.length === 0) {
    // Nothing survived — either one giant word (kept whole, clipped) or only
    // connectors (skipped; an empty name is better than "With").
    const first = words.find(w => !CONNECTORS.has(w.toLowerCase()));
    if (first) kept.push(first.slice(0, 26));
  }

  name = size ? [...kept, size].join(' ') : kept.join(' ');
  // OpenFoodFacts often ships all-lowercase names ("coca-cola 33 cl").
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function fromOff(host: string, code: string): Promise<string | null> {
  const data = await fetchJson<OffResponse>(
    `${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`
  );
  const p = data?.product;
  if (!p) return null;
  let name = (p.product_name ?? '').trim();
  if (!name) name = (p.brands ?? '').split(',')[0].trim();
  if (!name) return null;
  const brand = (p.brands ?? '').split(',')[0].trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = `${brand} ${name}`;
  const qty = (p.quantity ?? '').trim();
  if (qty && !name.toLowerCase().includes(qty.toLowerCase())) name = `${name} ${qty}`;
  return name;
}

async function fromUpc(code: string): Promise<string | null> {
  const data = await fetchJson<UpcResponse>(`/ext/upc/lookup?upc=${encodeURIComponent(code)}`);
  // Stripped HERE, not only in cleanProductName: the thin-name race must judge
  // the real words — "7590002031636 Shampoo" is a thin name, not a full one.
  return stripCodes(data?.items?.[0]?.title ?? '', code) || null;
}

export async function lookupBarcodeName(code: string): Promise<string | null> {
  const attempts = [
    ...OFF_HOSTS.map(host => fromOff(host, code)),
    fromUpc(code),
  ];

  // The race is only between FULL names — a thin one must not beat a full one
  // just by arriving first. (Hand-rolled Promise.any: the build target predates it.)
  const firstFull = new Promise<string | null>(resolve => {
    let pending = attempts.length;
    for (const p of attempts) {
      p.then(name => {
        if (name && !isThinName(name)) resolve(name);
        else if (--pending === 0) resolve(null);
      });
    }
  });

  const full = await firstFull;
  if (full) return cleanProductName(full, code) || null;
  const names = (await Promise.all(attempts)).filter((n): n is string => !!n);
  return names.length ? cleanProductName(names[0], code) || null : null;
}
