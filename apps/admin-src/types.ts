import type {
  CountryStat,
  BrochureAnalyticsRow,
  SeriesPoint,
  AnalyticsDelta,
  PeakDay,
  WeekdayStat,
  ProjectAnalyticsRow,
} from '../shared/analytics';

export type {
  CountryStat,
  BrochureAnalyticsRow,
  SeriesPoint,
  AnalyticsDelta,
  PeakDay,
  WeekdayStat,
  ProjectAnalyticsRow,
};

export interface Plan {
  name: string;
  monthly_brochure_limit?: number | null;
  max_file_bytes?: number;
  max_storage_bytes?: number | null;
  features?: {
    unlimited_brochures?: boolean;
    unlimited_storage?: boolean;
    max_storage_bytes?: number;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | string;
  plan_id?: string;
  plans?: Plan;
  active_brochures?: number;
  usage_this_month?: number;
  storage_used_bytes?: number;
}

export interface AccessCode {
  id: string;
  code: string;
  active: boolean;
  created_at: string;
}

export interface OrgAnalyticsRow {
  org_id: string;
  organization?: { name?: string; slug?: string };
  brochure_count?: number;
  total?: number;
  unique_visitors?: number;
  countries?: CountryStat[];
}

export interface AnalyticsOverview {
  total?: number;
  unique_visitors?: number;
  countries?: CountryStat[];
  series?: SeriesPoint[];
  by_brochure?: BrochureAnalyticsRow[];
  by_project?: ProjectAnalyticsRow[];
  organizations?: OrgAnalyticsRow[];
  window_days?: number;
  delta?: AnalyticsDelta;
  peak?: PeakDay | null;
  opens_per_unique?: number;
  weekday?: WeekdayStat[];
}

export interface OrgAnalyticsDetail {
  organization?: { name?: string; slug?: string };
  total?: number;
  unique_visitors?: number;
  brochure_count?: number;
  countries?: CountryStat[];
  by_brochure?: BrochureAnalyticsRow[];
  by_project?: ProjectAnalyticsRow[];
  series?: SeriesPoint[];
  window_days?: number;
  delta?: AnalyticsDelta;
  peak?: PeakDay | null;
  opens_per_unique?: number;
  weekday?: WeekdayStat[];
}
