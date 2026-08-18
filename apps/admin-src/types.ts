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

export interface CountryStat {
  country?: string;
  country_name?: string;
  count: number;
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
  organizations?: OrgAnalyticsRow[];
}

export interface BrochureAnalyticsRow {
  brochure_id?: string;
  title?: string;
  filename?: string;
  project_name?: string;
  total?: number;
  unique_visitors?: number;
  countries?: CountryStat[];
}

export interface OrgAnalyticsDetail {
  organization?: { name?: string; slug?: string };
  total?: number;
  unique_visitors?: number;
  brochure_count?: number;
  countries?: CountryStat[];
  by_brochure?: BrochureAnalyticsRow[];
}
