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
 * Formula: normalize(downloads_7d)
 * For MVP: downloads_7d is stubbed to 0, so score will be 0 until real data is added
 */
export function computeEngagementScore(
  downloads7d: number,
  githubRepoCount: number,
  allMetrics: PaperMetric[]
): number {
  // Normalize downloads_7d across all papers
  const downloads7dCounts = allMetrics.map(m => m.downloads_7d);
  const minDownloads = Math.min(...downloads7dCounts, 0);
  const maxDownloads = Math.max(...downloads7dCounts, 0);
  const downloads7dNorm = normalize(downloads7d, minDownloads, maxDownloads);

  return downloads7dNorm;
}

/**
 * Compute engagement scores for all metrics in a batch
 * This ensures proper normalization across the entire dataset
 */
export async function computeEngagementScoresForDate(
  snapshotDate: string
): Promise<void> {
  // Fetch all metrics for this date
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

  // Compute scores for all metrics
  const updates = metrics.map(metric => {
    const score = computeEngagementScore(
      metric.downloads_7d,
      metric.github_repo_count,
      metrics
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
