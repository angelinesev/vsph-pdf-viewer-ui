import type { OrgAnalyticsDetail } from './types';
import { exportAnalyticsPdf as printOrgAnalytics } from '../shared/printAnalytics';

export function exportAnalyticsPdf(detail: OrgAnalyticsDetail, windowDays: number): string | null {
  return printOrgAnalytics(detail, windowDays);
}
