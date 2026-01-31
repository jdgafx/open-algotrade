import React from 'react';

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1 }: { value?: number[]; onValueChange?: (value: number[]) => void; min?: number; max?: number; step?: number }) {
  const currentValue = value?.[0] ?? min;
  
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
    />
  );
}
