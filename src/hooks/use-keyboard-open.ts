import { useEffect, useState } from 'react';

/**
 * True while the on-screen keyboard covers a meaningful slice of the screen.
 *
 * Two keyboard models exist and both must be caught: iOS shrinks only the
 * visual viewport (the layout viewport keeps its height), while Android — and
 * Telegram's Android webview — resizes the whole webview, so window.innerHeight
 * shrinks in lockstep and can't serve as the reference. The baseline is
 * therefore the tallest visual viewport seen so far, re-learned after a
 * rotation (otherwise portrait height would read landscape as "keyboard open").
 */
function editableFocused(): boolean {
  const el = document.activeElement;
  return !!el && el.matches('input, textarea, select, [contenteditable]');
}

export default function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let base = vv.height;
    const recompute = () => {
      base = Math.max(base, vv.height);
      // Height alone lies inside Telegram (the webview shrinks for its own
      // chrome too) — a keyboard is only "open" if a field actually has focus.
      setOpen(base - vv.height > 150 && editableFocused());
    };
    const onOrientation = () => {
      base = 0;
    };
    // focus moves and viewport resizes race each other; a small delay lets
    // both settle before deciding.
    const recomputeSoon = () => setTimeout(recompute, 80);
    vv.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', onOrientation);
    window.addEventListener('focusin', recomputeSoon);
    window.addEventListener('focusout', recomputeSoon);
    return () => {
      vv.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('focusin', recomputeSoon);
      window.removeEventListener('focusout', recomputeSoon);
    };
  }, []);

  return open;
}
