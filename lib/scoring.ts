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
 * Formula: 0.6 * normalize(downloads_7d) + 0.4 * normalize(github_repo_count)
 * For MVP: downloads_7d is stubbed to 0, so only normalize github_repo_count
 */
export function computeEngagementScore(
  downloads7d: number,
  githubRepoCount: number,
  allMetrics: PaperMetric[]
): number {
  // For MVP, downloads_7d is always 0, so its normalization is 0
  const downloads7dNorm = 0;

  // Normalize github_repo_count across all papers
  const githubCounts = allMetrics.map(m => m.github_repo_count);
  const minGithub = Math.min(...githubCounts, 0);
  const maxGithub = Math.max(...githubCounts, 0);
  const githubNorm = normalize(githubRepoCount, minGithub, maxGithub);

  return 0.6 * downloads7dNorm + 0.4 * githubNorm;
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
