import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileOverlay({
  open,
  onOpenChange,
  title,
  children,
  action,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col w-full max-w-[430px] mx-auto md:mx-0 md:left-auto md:right-0',
          // The sm:-prefixed halves are load-bearing: DialogContent ships
          // `p-5 sm:p-6`, `top-[8%] sm:top-[50%]` and sm: slide animations, and
          // an unprefixed override only cancels the unprefixed half —
          // tailwind-merge keeps the sm: classes, and at ≥640px they win the
          // cascade. `sm:top-[50%]` alone pushed every sheet half off-screen
          // on desktop, submit buttons unreachable.
          'h-app max-h-app bg-background border-0 md:border-l md:border-border rounded-none p-0 sm:p-0 gap-0 overflow-hidden shadow-2xl',
          'sm:top-0',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'sm:data-[state=closed]:slide-out-to-bottom sm:data-[state=open]:slide-in-from-bottom',
          'md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right',
          '!translate-x-0 !translate-y-0',
          className
        )}
        hideCloseButton
      >
        <div className="shrink-0 border-b border-border bg-background/90 backdrop-blur-md safe-area-top z-10">
          <div className="flex items-center justify-between gap-2 px-2 h-14">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Orqaga"
              className="h-10 w-10 md:h-10 md:w-10 shrink-0 text-primary bg-primary/10 hover:bg-primary/20 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <DialogTitle className="flex-1 text-center text-[17px] font-bold truncate px-1 tracking-tight">
              {title}
            </DialogTitle>

            <div className="min-w-10 shrink-0 flex items-center justify-end">
              {action}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
