import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, FlashlightOff, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { cn } from '@/lib/utils';

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

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

function applyAdvanced(scanner: Html5Qrcode, constraint: AdvancedConstraint): Promise<void> {
  return scanner.applyVideoConstraints({ advanced: [constraint] } as unknown as MediaTrackConstraints);
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
  const containerRef = useRef<HTMLDivElement>(null);
  // The live scanner, for the torch/zoom controls. Set only after start()
  // resolves, cleared in the effect's cleanup before teardown begins.
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Callers pass inline arrows for these, so their identity changes on every
  // parent render. Keeping them in refs lets the camera effect depend only on
  // `open` — otherwise the camera tears down and restarts on each render.
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  onDetectedRef.current = onDetected;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    let scanner: Html5Qrcode | null = null;
    let started = false;
    // Cleanup awaits this. Closing the dialog while start() was still negotiating
    // the stream used to leave `started === false`, so stop() was never called:
    // the camera stayed live — indicator on, unusable by other apps — and a
    // second Html5Qrcode was constructed on top of the orphan on the next open.
    let startup: Promise<void> = Promise.resolve();
    setError(null);
    setTorchAvailable(false);
    setTorchOn(false);
    setZoomRange(null);

    const onSuccess = (decodedText: string) => {
      if (!isMounted) return;
      onDetectedRef.current(decodedText);
      onOpenChangeRef.current(false);
    };
    // No qrbox: the whole frame is decoded, so a barcode reads the moment it is
    // anywhere in view — the cashier doesn't have to thread it into a window.
    // (The white frame in the overlay is aiming guidance, not a boundary.) It
    // also removes the library's own shaded-region markers, which sat on the
    // video's box rather than ours and drew a second, misaligned "window".
    //
    // videoConstraints asks for 1280×720: without it the browser hands over
    // 640×480, which leaves a dense EAN-13 too few pixels per bar to decode —
    // the single biggest reason worn barcodes "never scan". `ideal` (never
    // `exact`) so a webcam that can't do 720p still opens at whatever it has.
    const scanConfig = { fps: 20 };
    const hd = { width: { ideal: 1280 }, height: { ideal: 720 } };

    // After the stream is live: switch to continuous autofocus where the camera
    // supports it (a fixed-focus start leaves close-up barcodes permanently
    // blurred on many Androids), and surface torch/zoom controls if the
    // hardware has them.
    const enhanceTrack = async (s: Html5Qrcode) => {
      let caps: TrackCapabilities = {};
      try {
        caps = s.getRunningTrackCapabilities() as TrackCapabilities;
      } catch {
        return;
      }
      if (caps.focusMode?.includes('continuous')) {
        await applyAdvanced(s, { focusMode: 'continuous' }).catch(() => null);
      }
      if (!isMounted) return;
      setTorchAvailable(caps.torch === true);
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        setZoomRange({
          min: caps.zoom.min,
          max: Math.min(caps.zoom.max, caps.zoom.min * 5),
          step: caps.zoom.step || 0.1,
        });
        setZoom(caps.zoom.min);
      }
    };

    // Wait a bit for the overlay animation and DOM to settle.
    const timer = setTimeout(() => {
      if (!isMounted || !containerRef.current) return;
      startup = (async () => {
      try {
        scanner = new Html5Qrcode(containerRef.current!.id, {
          verbose: false,
          formatsToSupport: SUPPORTED_FORMATS,
          // Hand decoding to the browser's built-in BarcodeDetector where it
          // exists (all modern Android Chrome): it reads off the live camera far
          // faster and locks onto worn or angled barcodes the JS decoder misses.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });

        // Prefer the rear camera, but fall back to the front camera or any
        // available device — many laptops/desktops only have one camera and
        // reject an "environment" facingMode constraint outright.
        try {
          await scanner.start({ facingMode: 'environment' }, { ...scanConfig, videoConstraints: { facingMode: 'environment', ...hd } }, onSuccess, undefined);
        } catch {
          if (!isMounted) return;
          try {
            await scanner.start({ facingMode: 'user' }, { ...scanConfig, videoConstraints: { facingMode: 'user', ...hd } }, onSuccess, undefined);
          } catch {
            if (!isMounted) return;
            const cameras = await Html5Qrcode.getCameras().catch(() => []);
            if (!isMounted) return;
            if (cameras.length > 0) {
              await scanner.start(cameras[0].id, scanConfig, onSuccess, undefined);
            } else {
              throw new Error('no-camera');
            }
          }
        }
        // Set even when the dialog has already closed — the stream is live and
        // somebody has to stop it.
        started = true;
        scannerRef.current = scanner;
        await enhanceTrack(scanner);
      } catch {
        if (isMounted) {
          setError(
            typeof navigator !== 'undefined' && !navigator.mediaDevices
              // Chrome/Safari hide the camera API entirely on a non-HTTPS origin,
              // which is exactly how a shop tablet on a LAN IP is usually opened.
              ? "Kamera faqat HTTPS orqali ishlaydi. Shtrix-kodni qo'lda kiriting."
              : "Kameraga ruxsat berilmadi yoki qurilma topilmadi. Shtrix-kodni qo'lda kiriting."
          );
        }
      }
      })();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      scannerRef.current = null;
      // Wait for a start that may still be in flight before tearing it down.
      startup.finally(() => {
        if (scanner && started) {
          scanner.stop().then(() => scanner?.clear()).catch(() => {
            try { scanner?.clear(); } catch { /* already torn down */ }
          });
        }
      });
    };
  }, [open]);

  function toggleTorch() {
    const s = scannerRef.current;
    if (!s) return;
    const next = !torchOn;
    applyAdvanced(s, { torch: next })
      .then(() => setTorchOn(next))
      .catch(() => null);
  }

  function handleZoom(value: number) {
    const s = scannerRef.current;
    if (!s) return;
    setZoom(value);
    applyAdvanced(s, { zoom: value }).catch(() => null);
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col h-full bg-black">
        <div className="flex-1 relative overflow-hidden">
          {/* html5-qrcode overwrites the scanner element's position with an
              inline `relative` and sizes the video to its natural aspect, so
              the element can't stretch itself — this wrapper centers it
              instead. Portrait phone streams fill the screen; a landscape
              webcam letterboxes in the middle rather than sticking to the top. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div id={SCANNER_ELEMENT_ID} ref={containerRef} className="w-full" />
          </div>
          {!error && (
            <>
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] max-w-[340px] aspect-[5/3] rounded-3xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
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
