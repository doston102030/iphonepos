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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: SUPPORTED_FORMATS,
    });

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      decodedText => {
        if (cancelled) return;
        cancelled = true;
        onDetected(decodedText);
        onOpenChange(false);
      },
      () => {},
    ).catch(() => {
      if (!cancelled) setError("Kameraga ruxsat berilmadi yoki kamera topilmadi. Qo'lda kiriting.");
    });

    return () => {
      cancelled = true;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
          <div id={SCANNER_ELEMENT_ID} className="w-full" />
        </div>
        {error ? (
          <p className="text-sm text-destructive text-center">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Kamerani shtrix-kodga qarating</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScanButton({
  onClick, className,
}: { onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" size="icon" onClick={onClick} title="Skanerlash" className={className}>
      <Camera className="h-4 w-4" />
    </Button>
  );
}
