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
export default function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let base = vv.height;
    const onResize = () => {
      base = Math.max(base, vv.height);
      setOpen(base - vv.height > 150);
    };
    const onOrientation = () => {
      base = 0;
    };
    vv.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      vv.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return open;
}
