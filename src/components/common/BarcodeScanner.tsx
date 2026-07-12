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
      { fps: 20, qrbox: { width: 280, height: 280 } },
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
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md p-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center relative">
          <div id={SCANNER_ELEMENT_ID} className="w-full h-full object-cover" />
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
