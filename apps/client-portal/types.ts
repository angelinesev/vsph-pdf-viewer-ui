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

export interface Project {
  id: string;
  name: string;
  slug: string;
  brochure_count?: number;
  last_upload_at?: string | null;
}

export interface Brochure {
  id: string;
  title?: string;
  filename: string;
  view_type: 'brochure' | 'flyer';
  created_at: string;
}

export interface Quota {
  organization: { name: string };
  plan: { name: string };
  used: number;
  limit: number | null;
  storage_used: number | null;
  max_storage_bytes: number | null;
}

export interface OrgAnalytics {
  total?: number;
  unique_visitors?: number;
  brochure_count?: number;
  window_days?: number;
  countries?: CountryStat[];
  by_brochure?: BrochureAnalyticsRow[];
  by_project?: ProjectAnalyticsRow[];
  series?: SeriesPoint[];
  delta?: AnalyticsDelta;
  peak?: PeakDay | null;
  opens_per_unique?: number;
  weekday?: WeekdayStat[];
  organization?: { id?: string; name?: string; slug?: string };
}

export interface BrochureAnalytics {
  total?: number;
  unique_visitors?: number;
  countries?: CountryStat[];
}

export interface LinkResult {
  vanity_url?: string;
  token_url?: string;
  url?: string;
}

export interface UploadPrepared {
  upload: { signedUrl: string };
  brochure_id: string;
  project_id: string;
  storage_path: string;
  slug: string;
  view_type: string;
}
