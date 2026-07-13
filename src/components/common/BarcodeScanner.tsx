import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera } from 'lucide-react';
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

export function BarcodeScannerDialog({
  open, onOpenChange, onDetected, title = 'Shtrix-kodni skanerlash',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    const onSuccess = (decodedText: string) => {
      if (!isMounted) return;
      onDetectedRef.current(decodedText);
      onOpenChangeRef.current(false);
    };
    // A wide, short scanning window — a product barcode is a horizontal strip,
    // not a square, so the box tracks its shape and the camera samples faster.
    const scanConfig = {
      fps: 20,
      qrbox: (vw: number, vh: number) => {
        const width = Math.floor(Math.min(vw * 0.85, 340));
        const height = Math.floor(Math.min(width * 0.6, vh * 0.5));
        return { width, height };
      },
      aspectRatio: 1.777,
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
          await scanner.start({ facingMode: 'environment' }, scanConfig, onSuccess, undefined);
        } catch {
          if (!isMounted) return;
          try {
            await scanner.start({ facingMode: 'user' }, scanConfig, onSuccess, undefined);
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

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col h-full bg-black">
        <div className="flex-1 relative overflow-hidden">
          <div id={SCANNER_ELEMENT_ID} ref={containerRef} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {!error && (
            <>
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] max-w-[340px] aspect-[5/3] rounded-3xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
                {/* A red aiming line down the middle — line it up with the barcode. */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 rounded-full" />
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 px-6 py-6 pb-8 bg-black text-center safe-area-bottom">
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
