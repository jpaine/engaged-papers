import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published_at: string;
  updated_at: string;
  created_at?: string;
}

export interface PaperMetric {
  id?: number;
  paper_id: string;
  snapshot_date: string;
  downloads_total: number;
  downloads_7d: number;
  github_repo_count: number;
  engagement_score: number;
}

export interface PaperWithMetrics extends Paper {
  metrics?: PaperMetric;
}
