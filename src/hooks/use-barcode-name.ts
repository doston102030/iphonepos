import { useEffect, useRef } from 'react';
import { lookupBarcodeName } from '@/lib/barcodeLookup';

/**
 * Watches a barcode field and quietly fills the name field from the open
 * product databases. A hand-typed name is sacred: the hook only ever writes
 * into an empty name or over its own previous suggestion, and a stale answer
 * (an older lookup resolving after a newer scan) is thrown away.
 */
export default function useBarcodeName(
  barcode: string | undefined,
  enabled: boolean,
  getName: () => string,
  setName: (name: string) => void,
) {
  const lastAuto = useRef('');
  const seq = useRef(0);
  const getNameRef = useRef(getName);
  const setNameRef = useRef(setName);
  getNameRef.current = getName;
  setNameRef.current = setName;

  useEffect(() => {
    if (!enabled) return;
    const code = (barcode ?? '').trim();
    // Real retail barcodes are 8–14 digits; don't fire on half-typed input.
    if (!/^\d{8,14}$/.test(code)) return;
    const current = getNameRef.current().trim();
    if (current && current !== lastAuto.current) return;

    const mySeq = ++seq.current;
    // A scan lands the whole code at once; typing arrives digit by digit —
    // the debounce keeps a lookup from firing on every keystroke past 8.
    const timer = setTimeout(() => {
      lookupBarcodeName(code).then(name => {
        if (!name || mySeq !== seq.current) return;
        const now = getNameRef.current().trim();
        if (now && now !== lastAuto.current) return;
        setNameRef.current(name);
        lastAuto.current = name;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [barcode, enabled]);

  // A fresh dialog must not inherit the previous product's suggestion.
  useEffect(() => {
    if (!enabled) {
      lastAuto.current = '';
      seq.current++;
    }
  }, [enabled]);
}
