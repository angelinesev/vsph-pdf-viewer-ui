import { useEffect } from 'react';
import type { CountryStat } from './types';

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

export function countryLabel(entry: CountryStat | string | null | undefined): string {
  if (!entry) return 'Unknown';
  if (typeof entry === 'object' && entry.country_name && entry.country_name !== 'Unknown') {
    return entry.country_name;
  }
  const code = typeof entry === 'object' ? entry.country : entry;
  if (!code || code === 'XX') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function embedSnippet(url: string): string {
  const src = String(url || '').replace(/"/g, '&quot;');
  return `<iframe src="${src}" width="100%" height="720" style="border:0;" allowfullscreen loading="lazy" title="Brochure"></iframe>`;
}
