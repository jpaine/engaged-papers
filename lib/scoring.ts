import { supabase, PaperMetric } from './supabase';

/**
 * Normalize a value to [0, 1] using min-max normalization
 * Returns 0 if max is 0 or if all values are the same
 */
function normalize(value: number, min: number, max: number): number {
  if (max === 0 || max === min) {
    return 0;
  }
  return (value - min) / (max - min);
}

/**
 * Compute engagement score for a single paper metric
 * Formula: normalize(downloads_7d) where downloads_7d contains citation counts
 * Uses citation counts from Semantic Scholar as the engagement metric
 * Falls back to recency-based scoring when citations are 0
 */
export function computeEngagementScore(
  downloads7d: number,
  githubRepoCount: number,
  allMetrics: PaperMetric[],
  publishedAt?: string,
  paperId?: string
): number {
  // Normalize downloads_7d (which contains citation counts) across all papers
  const downloads7dCounts = allMetrics.map(m => m.downloads_7d);
  const minDownloads = Math.min(...downloads7dCounts, 0);
  const maxDownloads = Math.max(...downloads7dCounts, 0);
  
  // If we have citations, use them
  if (maxDownloads > 0) {
    const downloads7dNorm = normalize(downloads7d, minDownloads, maxDownloads);
    return downloads7dNorm;
  }
  
  // Fallback: Use recency-based scoring when all citations are 0
  // Sort metrics by published date (newest first) and assign scores based on position
  const metricsWithDates = allMetrics.map((m: any) => ({
    ...m,
    published_at: m.published_at || null,
  })).sort((a: any, b: any) => {
    if (!a.published_at || !b.published_at) return 0;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  
  // Find the index of the current metric in the sorted list using paper_id for uniqueness
  const paperIndex = paperId 
    ? metricsWithDates.findIndex((m: any) => m.paper_id === paperId)
    : metricsWithDates.findIndex((m: any) => m.downloads_7d === downloads7d);
  
  if (paperIndex >= 0 && metricsWithDates.length > 1) {
    // Distribute scores from 0.1 to 1.0 based on recency (newer = higher)
    // This ensures meaningful differentiation even when all citations are 0
    return 0.1 + (0.9 * (1 - paperIndex / (metricsWithDates.length - 1)));
  }
  
  return 0;
}

/**
 * Compute engagement scores for all metrics in a batch
 * This ensures proper normalization across the entire dataset
 */
export async function computeEngagementScoresForDate(
  snapshotDate: string
): Promise<void> {
  // Fetch all metrics
  const { data: metrics, error } = await supabase
    .from('paper_metrics')
    .select('*')
    .eq('snapshot_date', snapshotDate);

  if (error) {
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }

  if (!metrics || metrics.length === 0) {
    return;
  }

  // Fetch published dates for all papers
  const paperIds = metrics.map(m => m.paper_id);
  const { data: papers, error: papersError } = await supabase
    .from('papers')
    .select('id, published_at')
    .in('id', paperIds);

  if (papersError) {
    throw new Error(`Failed to fetch papers: ${papersError.message}`);
  }

  // Create a map of paper_id -> published_at
  const paperDateMap = new Map<string, string>();
  for (const paper of papers || []) {
    paperDateMap.set(paper.id, paper.published_at);
  }

  // Attach published dates to metrics for recency-based scoring
  const metricsWithDates = metrics.map((m) => ({
    ...m,
    published_at: paperDateMap.get(m.paper_id) || null,
  }));

  // Sort by published_at (newest first) for better scoring
  metricsWithDates.sort((a: any, b: any) => {
    if (!a.published_at || !b.published_at) return 0;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  // Compute scores for all metrics
  const updates = metricsWithDates.map((metric: any) => {
    const score = computeEngagementScore(
      metric.downloads_7d,
      metric.github_repo_count,
      metricsWithDates,
      metric.published_at,
      metric.paper_id
    );
    return {
      id: metric.id,
      engagement_score: score,
    };
  });

  // Update scores in batch
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('paper_metrics')
      .update({ engagement_score: update.engagement_score })
      .eq('id', update.id);

    if (updateError) {
      console.error(`Failed to update score for metric ${update.id}:`, updateError);
    }
  }
}
