import React from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumericKeypadProps {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  className?: string;
  allowDecimal?: boolean;
}

export function NumericKeypad({ value, onChange, onEnter, className, allowDecimal = true }: NumericKeypadProps) {
  const handlePress = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (allowDecimal && !value.includes('.')) {
        onChange(value === '' ? '0.' : value + '.');
      }
    } else if (key === '00') {
      onChange(value === '' || value === '0' ? '0' : value + '00');
    } else if (key === '000') {
      onChange(value === '' || value === '0' ? '0' : value + '000');
    } else if (key === 'enter') {
      onEnter?.();
    } else {
      if (value === '0') onChange(key);
      else onChange(value + key);
    }
  };

  const btnClass = "h-14 flex items-center justify-center text-2xl font-semibold bg-muted/40 active:bg-muted/80 rounded-2xl transition-colors select-none";

  return (
    <div className={cn("grid grid-cols-3 gap-2 p-2 bg-background select-none", className)}>
      <button type="button" onClick={() => handlePress('1')} className={btnClass}>1</button>
      <button type="button" onClick={() => handlePress('2')} className={btnClass}>2</button>
      <button type="button" onClick={() => handlePress('3')} className={btnClass}>3</button>
      
      <button type="button" onClick={() => handlePress('4')} className={btnClass}>4</button>
      <button type="button" onClick={() => handlePress('5')} className={btnClass}>5</button>
      <button type="button" onClick={() => handlePress('6')} className={btnClass}>6</button>
      
      <button type="button" onClick={() => handlePress('7')} className={btnClass}>7</button>
      <button type="button" onClick={() => handlePress('8')} className={btnClass}>8</button>
      <button type="button" onClick={() => handlePress('9')} className={btnClass}>9</button>
      
      <button type="button" onClick={() => handlePress('00')} className={cn(btnClass, "text-xl font-bold")}>00</button>
      <button type="button" onClick={() => handlePress('0')} className={btnClass}>0</button>
      <button type="button" onClick={() => handlePress('backspace')} className={cn(btnClass, "text-muted-foreground")}>
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
}
