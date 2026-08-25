import { useEffect } from 'react';
import type { RefObject } from 'react';
import { countryLabel } from '../shared/analytics';

let bodyScrollLockCount = 0;
let previousBodyOverflow = '';

export function useLockBodyScroll(): void {
  useEffect(() => {
    if (bodyScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    bodyScrollLockCount += 1;
    return () => {
      bodyScrollLockCount -= 1;
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, []);
}

export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return 'Custom';
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + ' GB';
  return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + ' MB';
}

export function pct(used: number, limit: number | null | undefined): number {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export { countryLabel };

export function embedSnippet(url: string): string {
  const src = String(url || '').replace(/"/g, '&quot;');
  return `<iframe src="${src}" width="100%" height="720" style="border:0;" allowfullscreen loading="lazy" title="Brochure"></iframe>`;
}
