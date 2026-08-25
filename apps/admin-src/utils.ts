import type { Plan } from './types';
import { countryLabel, formatCountryStat } from '../shared/analytics';

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return 'Custom';
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + ' GB';
  return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + ' MB';
}

export function brochureLimitLabel(p: Plan | number | null | undefined): string {
  if (p && typeof p === 'object') {
    if (p.features?.unlimited_brochures || p.monthly_brochure_limit == null) return 'Unlimited';
    return String(p.monthly_brochure_limit);
  }
  return p == null ? 'Unlimited' : String(p);
}

export function storageLimitOf(p: Plan | null | undefined): number | null {
  if (!p) return null;
  if (p.max_storage_bytes != null) return p.max_storage_bytes;
  if (p.features?.unlimited_storage) return null;
  if (p.features?.max_storage_bytes != null) return Number(p.features.max_storage_bytes);
  return null;
}

export { countryLabel, formatCountryStat };
