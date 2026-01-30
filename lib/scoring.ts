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
  publishedAt?: string
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
  // This gives newer papers a higher baseline score
  // Use exact timestamp differences for precise differentiation
  const now = new Date().getTime();
  const timestampScores: number[] = [];
  
  for (const m of allMetrics) {
    const metricWithDate = m as any;
    if (metricWithDate.published_at) {
      const publishedTimestamp = new Date(metricWithDate.published_at).getTime();
      // Use inverse of milliseconds since published (newer = higher score)
      // Add 1 to avoid division by zero, scale by 1 day in ms
      const msSincePublished = Math.max(0, now - publishedTimestamp);
      const score = 1 / (1 + msSincePublished / (1000 * 60 * 60 * 24)); // Normalize by 1 day
      timestampScores.push(score);
    } else {
      timestampScores.push(0);
    }
  }
  
  if (timestampScores.length > 0 && Math.max(...timestampScores) > 0) {
    const currentMetric = allMetrics.find((m: any) => m.downloads_7d === downloads7d) as any;
    if (currentMetric?.published_at) {
      const currentPublishedTimestamp = new Date(currentMetric.published_at).getTime();
      const msSincePublished = Math.max(0, now - currentPublishedTimestamp);
      const currentScore = 1 / (1 + msSincePublished / (1000 * 60 * 60 * 24));
      
      const minScore = Math.min(...timestampScores);
      const maxScore = Math.max(...timestampScores);
      
      if (maxScore > minScore) {
        return normalize(currentScore, minScore, maxScore);
      }
    }
  }
  
  // Final fallback: use paper index (newer papers get slightly higher scores)
  // This ensures all papers get different scores even if published at exact same time
  const paperIndex = allMetrics.findIndex(m => m.downloads_7d === downloads7d);
  if (paperIndex >= 0 && allMetrics.length > 1) {
    // Distribute scores from 0.5 to 1.0 based on index (newer = higher)
    return 0.5 + (0.5 * (1 - paperIndex / (allMetrics.length - 1)));
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
      metric.published_at
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
