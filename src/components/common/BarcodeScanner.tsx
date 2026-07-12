import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

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

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    let scanner: Html5Qrcode | null = null;
    let started = false;
    setError(null);

    const onSuccess = (decodedText: string) => {
      if (!isMounted) return;
      onDetected(decodedText);
      onOpenChange(false);
    };
    const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Wait a bit for Dialog animation and DOM to settle
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
      } catch (err) {
        console.error('Scanner error:', err);
        if (isMounted) setError("Kameraga ruxsat berilmadi yoki qurilma topilmadi. Shtrix-kodni qo'lda kiriting.");
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scanner && started) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {
          try { scanner?.clear(); } catch {}
        });
      }
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md p-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center relative">
          <div id={SCANNER_ELEMENT_ID} ref={containerRef} className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none" />
          <div className="absolute inset-0 border-2 border-primary m-10 rounded-xl pointer-events-none" />
        </div>
        {error ? (
          <p className="text-sm text-destructive text-center font-medium">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground text-center font-medium">Kamerani shtrix-kodga qarating</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { cn } from '@/lib/utils';

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
      className={cn('h-11 w-11 rounded-xl shadow-sm border-border bg-card', className)}
    >
      <Camera className="h-5 w-5 text-primary" />
    </Button>
  );
}
