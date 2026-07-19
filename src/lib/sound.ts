// Short UI sounds, synthesised with the Web Audio API so there are no asset files
// to ship and nothing to load over the shop's wifi. A sale finishing with an
// audible "ding" is the cashier's confirmation without looking at the screen.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    // A tab that loaded before any tap starts the context "suspended".
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, gain = 0.14) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  // A quick fade in/out so the note lands soft, not as a click.
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** A bright two-note rise — "done". */
export function playSuccess() {
  tone(660, 0, 0.12);
  tone(990, 0.1, 0.16);
}

/** A single low note — "something's off". */
export function playError() {
  tone(200, 0, 0.28, 0.18);
}

/** One short high blip — the supermarket-scanner "got it". */
export function playScanBeep() {
  tone(1245, 0, 0.09, 0.2);
}
