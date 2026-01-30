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
  // Extract published dates from allMetrics (they should have published_at if fetched with papers)
  const now = new Date();
  const recencyScores: number[] = [];
  
  for (const m of allMetrics) {
    const metricWithDate = m as any;
    if (metricWithDate.published_at) {
      const publishedDate = new Date(metricWithDate.published_at);
      const daysSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Inverse recency: newer papers get higher scores
      const recencyScore = 1 / (1 + daysSincePublished);
      recencyScores.push(recencyScore);
    } else {
      recencyScores.push(0);
    }
  }
  
  if (recencyScores.length > 0 && Math.max(...recencyScores) > 0) {
    const currentMetric = allMetrics.find((m: any) => m.downloads_7d === downloads7d) as any;
    const currentRecency = currentMetric?.published_at 
      ? 1 / (1 + (now.getTime() - new Date(currentMetric.published_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const minRecency = Math.min(...recencyScores);
    const maxRecency = Math.max(...recencyScores);
    
    if (maxRecency > minRecency) {
      return normalize(currentRecency, minRecency, maxRecency);
    }
  }
  
  // Final fallback: use paper index (newer papers get slightly higher scores)
  const paperIndex = allMetrics.findIndex(m => m.downloads_7d === downloads7d);
  if (paperIndex >= 0 && allMetrics.length > 1) {
    return 1 - (paperIndex / (allMetrics.length - 1));
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
  // Fetch all metrics with their associated papers for published dates
  const { data: metrics, error } = await supabase
    .from('paper_metrics')
    .select(`
      *,
      papers!inner(published_at)
    `)
    .eq('snapshot_date', snapshotDate)
    .order('papers(published_at)', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }

  if (!metrics || metrics.length === 0) {
    return;
  }

  // Extract published dates for recency-based scoring
  const metricsWithDates = metrics.map((m: any) => ({
    ...m,
    published_at: m.papers?.published_at || null,
  }));

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
