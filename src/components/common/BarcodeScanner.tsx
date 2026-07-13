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
    setError(null);

    const onSuccess = (decodedText: string) => {
      if (!isMounted) return;
      onDetectedRef.current(decodedText);
      onOpenChangeRef.current(false);
    };
    const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Wait a bit for the overlay animation and DOM to settle.
    const timer = setTimeout(async () => {
      if (!isMounted || !containerRef.current) return;

      try {
        scanner = new Html5Qrcode(containerRef.current.id, {
          verbose: false,
          formatsToSupport: SUPPORTED_FORMATS,
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
        if (isMounted) started = true;
      } catch {
        if (isMounted) setError("Kameraga ruxsat berilmadi yoki qurilma topilmadi. Shtrix-kodni qo'lda kiriting.");
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scanner && started) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {
          try { scanner?.clear(); } catch { /* already torn down */ }
        });
      }
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
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[72vw] max-w-[280px] aspect-square rounded-3xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none" />
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
