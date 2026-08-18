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
}

export interface CountryStat {
  country?: string;
  country_name?: string;
  count: number;
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
