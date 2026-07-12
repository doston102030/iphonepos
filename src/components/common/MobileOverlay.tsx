import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
        className={cn(
          "fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col w-full max-w-[430px] mx-auto md:mx-0 md:left-auto md:right-0 h-[100dvh] bg-background border-0 sm:border-x md:border-x-0 md:border-l sm:border-border rounded-none p-0 overflow-hidden shadow-2xl transition-transform duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right !translate-x-0 !translate-y-0",
          className
        )}
        hideCloseButton
      >
        <div className="flex items-center justify-between px-2 h-14 shrink-0 border-b border-border bg-background/90 backdrop-blur-md safe-area-top z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 shrink-0 text-primary hover:bg-primary/10 rounded-full" 
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          
          <DialogTitle className="flex-1 text-center text-lg font-bold truncate px-2 tracking-tight">
            {title}
          </DialogTitle>
          
          <div className="w-10 shrink-0 flex items-center justify-center">
            {action}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto relative safe-area-bottom">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
