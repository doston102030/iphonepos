import { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, FlashlightOff, ZoomIn } from 'lucide-react';
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { Button } from '@/components/ui/button';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { playScanBeep } from '@/lib/sound';
import { cn } from '@/lib/utils';

// The decode stack, fastest first:
//   1. Native BarcodeDetector (Android Chrome) — hardware-accelerated, reads
//      straight off the video element, no pixel copying at all.
//   2. zxing-wasm (everything else, crucially iPhone) — the C++ ZXing compiled
//      to WebAssembly. This replaced html5-qrcode's JS decoder, which was the
//      reason iPhones "never scanned": the wasm build is an order of magnitude
//      faster and far better at worn, blurred and small (= far away) barcodes.
// Both paths scan the ENTIRE frame at native camera resolution, so a barcode
// does not have to sit inside the aiming window — the frame is only a guide.

// Ship the wasm with the app bundle instead of zxing's default CDN fetch:
// a shop tablet with flaky internet must still scan.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? zxingWasmUrl : prefix + path,
  },
});

// tryHarder/tryRotate/tryInvert/tryDownscale all default to true — that
// combination is what reads a code at arm's length or at an angle.
const READER_OPTIONS: ReaderOptions = {
  formats: ['EAN13', 'EAN8', 'Code128', 'Code39', 'UPCA', 'UPCE', 'ITF', 'QRCode'],
  maxNumberOfSymbols: 1,
};

const DETECTOR_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code'];

// torch/zoom/focusMode are real capabilities on Android Chrome and iOS 17+,
// but TypeScript's lib.dom doesn't know them yet — hence these local shapes.
interface TrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
}
interface AdvancedConstraint {
  torch?: boolean;
  zoom?: number;
  focusMode?: string;
}
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

function applyAdvanced(track: MediaStreamTrack, constraint: AdvancedConstraint): Promise<void> {
  return track.applyConstraints({ advanced: [constraint] } as unknown as MediaTrackConstraints);
}

async function createNativeDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = await Ctor.getSupportedFormats();
    const formats = DETECTOR_FORMATS.filter(f => supported.includes(f));
    return formats.length > 0 ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

export function BarcodeScannerDialog({
  open, onOpenChange, onDetected, title = 'Shtrix-kodni skanerlash',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The live camera track, for the torch/zoom controls.
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Callers pass inline arrows for these, so their identity changes on every
  // parent render. Keeping them in refs lets the camera effect depend only on
  // `open` — otherwise the camera tears down and restarts on each render.
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  onDetectedRef.current = onDetected;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let stream: MediaStream | null = null;
    setError(null);
    setTorchAvailable(false);
    setTorchOn(false);
    setZoomRange(null);
    setZoom(1);

    // Compile the wasm while the camera permission dialog / stream negotiation
    // runs, so the first frame can decode immediately.
    prepareZXingModule({ fireImmediately: true }).catch(() => null);

    // After the stream is live: continuous autofocus where supported (a
    // fixed-focus start leaves close-up barcodes permanently blurred on many
    // Androids), then surface torch/zoom controls if the hardware has them.
    const readCapabilities = (track: MediaStreamTrack): boolean => {
      let caps: TrackCapabilities = {};
      try {
        caps = track.getCapabilities() as TrackCapabilities;
      } catch {
        return false;
      }
      if (!alive) return false;
      setTorchAvailable(caps.torch === true);
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        setZoomRange({
          min: caps.zoom.min,
          max: Math.min(caps.zoom.max, caps.zoom.min * 5),
          step: caps.zoom.step || 0.1,
        });
        setZoom(caps.zoom.min);
      }
      return caps.torch === true || !!caps.zoom;
    };
    const enhanceTrack = async (track: MediaStreamTrack) => {
      let caps: TrackCapabilities = {};
      try {
        caps = track.getCapabilities() as TrackCapabilities;
      } catch {
        return;
      }
      if (caps.focusMode?.includes('continuous')) {
        await applyAdvanced(track, { focusMode: 'continuous' }).catch(() => null);
      }
      if (!alive) return;
      // iOS reports torch/zoom late on some devices — if nothing showed up on
      // the first read, ask once more after the track has settled.
      if (!readCapabilities(track)) {
        setTimeout(() => {
          if (alive && trackRef.current === track) readCapabilities(track);
        }, 900);
      }
    };

    // One frame, one answer. Native path feeds the video element straight to
    // the detector; wasm path copies the frame once and hands zxing the pixels.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const decodeOnce = async (video: HTMLVideoElement, native: BarcodeDetectorLike | null): Promise<string | null> => {
      if (video.readyState < 2 || video.videoWidth === 0) return null;
      if (native) {
        const codes = await native.detect(video).catch(() => [] as DetectedBarcode[]);
        return codes.find(c => c.rawValue)?.rawValue ?? null;
      }
      if (!ctx) return null;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const results = await readBarcodes(ctx.getImageData(0, 0, w, h), READER_OPTIONS).catch(() => []);
      return results.find(r => r.isValid && r.text)?.text ?? null;
    };

    (async () => {
      // Chrome/Safari hide the camera API entirely on a non-HTTPS origin,
      // which is exactly how a shop tablet on a LAN IP is usually opened.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera faqat HTTPS orqali ishlaydi. Shtrix-kodni qo'lda kiriting.");
        return;
      }
      try {
        try {
          // Full HD, not the 640×480 the browser volunteers: pixels per bar are
          // what let a dense EAN-13 decode from across the counter. `ideal`
          // (never `exact`) so a webcam that can't do 1080p still opens, and
          // `ideal: environment` so single-camera laptops don't reject.
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      } catch {
        if (alive) setError("Kameraga ruxsat berilmadi yoki qurilma topilmadi. Shtrix-kodni qo'lda kiriting.");
        return;
      }
      const video = videoRef.current;
      if (!alive || !video) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      video.srcObject = stream;
      trackRef.current = stream.getVideoTracks()[0] ?? null;
      // play() rejects if the dialog closed mid-negotiation; cleanup handles it.
      await video.play().catch(() => null);
      if (!alive) return;
      if (trackRef.current) void enhanceTrack(trackRef.current);

      const native = await createNativeDetector();
      if (!alive) return;

      // The scan loop. Sequential awaits are the backpressure: a new decode
      // never starts while one is in flight, so a slow phone simply scans at
      // its own pace instead of piling up work and freezing the preview.
      while (alive) {
        const t0 = performance.now();
        const code = await decodeOnce(video, native).catch(() => null);
        if (!alive) return;
        if (code) {
          // The supermarket blip: the cashier knows it read without looking.
          playScanBeep();
          onDetectedRef.current(code);
          onOpenChangeRef.current(false);
          return;
        }
        // Native detection is nearly free — go again next frame. The wasm pass
        // costs tens of ms on the main thread — breathe for half its cost so
        // the preview and the UI stay fluid.
        const pause = native ? 33 : Math.min(120, Math.max(30, (performance.now() - t0) / 2));
        await new Promise(r => setTimeout(r, pause));
      }
    })();

    return () => {
      alive = false;
      trackRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      // `stream` may still be null if cleanup ran during getUserMedia — the
      // in-flight branch above notices `alive === false` and stops the tracks.
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [open]);

  function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    applyAdvanced(track, { torch: next })
      .then(() => setTorchOn(next))
      .catch(() => null);
  }

  function handleZoom(value: number) {
    const track = trackRef.current;
    if (!track) return;
    setZoom(value);
    applyAdvanced(track, { zoom: value }).catch(() => null);
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col h-full bg-black">
        <div className="flex-1 relative overflow-hidden">
          {/* object-cover: the preview fills the screen edge-to-edge like the
              native camera app; decoding still sees the full uncropped frame. */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
          />
          {!error && (
            <>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[86vw] max-w-[350px] aspect-[5/3] rounded-3xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] pointer-events-none">
                {/* A red aiming line down the middle — line it up with the barcode. */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 rounded-full" />
              </div>
              {/* Camera controls float over the picture, above the hint bar. */}
              <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-4 px-6">
                {zoomRange && (
                  <div className="flex items-center gap-3 w-full max-w-[280px] rounded-full bg-black/50 backdrop-blur-md px-4 py-2.5">
                    <ZoomIn className="h-4 w-4 text-white/70 shrink-0" />
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={zoom}
                      onChange={e => handleZoom(Number(e.target.value))}
                      aria-label="Yaqinlashtirish"
                      className="flex-1 h-1.5 accent-white cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-white/80 tabular-nums w-8 text-right">
                      {zoom.toFixed(1)}x
                    </span>
                  </div>
                )}
                {torchAvailable && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    aria-label={torchOn ? "Chiroqni o'chirish" : 'Chiroqni yoqish'}
                    aria-pressed={torchOn}
                    className={cn(
                      'h-14 w-14 rounded-full flex items-center justify-center backdrop-blur-md transition-colors press',
                      torchOn ? 'bg-amber-400 text-black shadow-[0_0_24px_rgba(251,191,36,0.55)]' : 'bg-white/15 text-white'
                    )}
                  >
                    {torchOn ? <Flashlight className="h-6 w-6" /> : <FlashlightOff className="h-6 w-6" />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {/* One calc'd padding, not pb-8 + safe-area-bottom — both set
            padding-bottom, so one silently loses. */}
        <div className="shrink-0 px-6 pt-6 pb-[calc(2rem+var(--inset-bottom))] bg-black text-center">
          {error ? (
            <p className="text-sm text-red-400 font-medium">{error}</p>
          ) : (
            <p className="text-sm text-white/70 font-medium">Kamerani shtrix-kodga qarating</p>
          )}
        </div>
      </div>
    </MobileOverlay>
  );
}

export function ScanButton({
  onClick, className,
}: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      title="Skanerlash"
      aria-label="Skanerlash"
      className={cn('h-11 w-11 rounded-xl shadow-sm border-border bg-card', className)}
    >
      <Camera className="h-5 w-5 text-primary" />
    </Button>
  );
}
