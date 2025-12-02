import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MinusIcon, PlusIcon } from 'lucide-react';

const FONT_SIZES = [14, 16, 18, 20]; // in pixels for root element
const LOCAL_STORAGE_KEY = 'app-font-size';

// move helper to module scope to avoid hook dependency lint warnings
const findClosestIndex = (size: number): number => {
  let closest = 0;
  let minDiff = Infinity;
  for (let i = 0; i < FONT_SIZES.length; i++) {
    const diff = Math.abs(FONT_SIZES[i] - size);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
};

export const FontSizeAdjuster: React.FC = () => {
  const [currentSizeIndex, setCurrentSizeIndex] = useState(1);

  useEffect(() => {
    // guard for SSR / environments without document/localStorage
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const storedNum = stored ? parseInt(stored, 10) : NaN;
      const initialSize = !isNaN(storedNum) ? storedNum : 16;
      const initialIndex = findClosestIndex(initialSize);
      setCurrentSizeIndex(initialIndex);
      document.documentElement.style.fontSize = `${FONT_SIZES[initialIndex]}px`;
    } catch {
      // noop — fail safe in restricted environments
    }
  }, []);

  const adjustFontSize = useCallback((direction: 'increase' | 'decrease') => {
    setCurrentSizeIndex(prevIndex => {
      const newIndex = direction === 'increase'
        ? Math.min(prevIndex + 1, FONT_SIZES.length - 1)
        : Math.max(prevIndex - 1, 0);

      if (newIndex !== prevIndex) {
        const newSize = FONT_SIZES[newIndex];
        // guard DOM access
        if (typeof document !== 'undefined') {
          document.documentElement.style.fontSize = `${newSize}px`;
        }
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, newSize.toString());
          }
        } catch {
          // ignore storage errors
        }
      }
      return newIndex;
    });
  }, []);

  // Keyboard support for accessibility
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      adjustFontSize('increase');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      adjustFontSize('decrease');
    }
  }, [adjustFontSize]);

  return (
    <div
      className="flex items-center gap-2"
      role="toolbar"
      aria-label="Font size controls"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => adjustFontSize('decrease')}
        disabled={currentSizeIndex === 0}
        aria-label="Decrease font size"
      >
        <MinusIcon className="h-4 w-4" />
      </Button>

      {/* simple accessible visual indicator (avoids missing icon import) */}
      <span
        className="inline-flex items-center justify-center h-5 w-5 text-sm font-medium"
        aria-hidden="true"
      >
        A
      </span>

      {/* visible current size */}
      <span className="text-sm px-1" aria-hidden="true">
        {FONT_SIZES[currentSizeIndex]}px
      </span>

      {/* aria-live region for screen readers */}
      <span className="sr-only" aria-live="polite">
        {`Font size set to ${FONT_SIZES[currentSizeIndex]} pixels`}
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={() => adjustFontSize('increase')}
        disabled={currentSizeIndex === FONT_SIZES.length - 1}
        aria-label="Increase font size"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};