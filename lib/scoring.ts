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
  const publishedDates: Date[] = [];
  
  for (const m of allMetrics) {
    const metricWithDate = m as any;
    if (metricWithDate.published_at) {
      const publishedDate = new Date(metricWithDate.published_at);
      publishedDates.push(publishedDate);
      const daysSincePublished = Math.max(0, (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
      // Use hours since published for better granularity (papers published same day can differ)
      const hoursSincePublished = Math.max(0, (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
      // Inverse recency: newer papers get higher scores (using hours for better differentiation)
      const recencyScore = 1 / (1 + hoursSincePublished / 24); // Convert hours to days for scoring
      recencyScores.push(recencyScore);
    } else {
      publishedDates.push(new Date(0));
      recencyScores.push(0);
    }
  }
  
  if (recencyScores.length > 0 && Math.max(...recencyScores) > 0) {
    const currentMetric = allMetrics.find((m: any) => m.downloads_7d === downloads7d) as any;
    if (currentMetric?.published_at) {
      const currentPublishedDate = new Date(currentMetric.published_at);
      const hoursSincePublished = Math.max(0, (now.getTime() - currentPublishedDate.getTime()) / (1000 * 60 * 60));
      const currentRecency = 1 / (1 + hoursSincePublished / 24);
      
      const minRecency = Math.min(...recencyScores);
      const maxRecency = Math.max(...recencyScores);
      
      if (maxRecency > minRecency) {
        return normalize(currentRecency, minRecency, maxRecency);
      } else if (maxRecency > 0) {
        // All papers have same recency (same day), use time-of-day as tiebreaker
        const currentHours = currentPublishedDate.getHours() + currentPublishedDate.getMinutes() / 60;
        const allHours = publishedDates.map(d => d.getHours() + d.getMinutes() / 60);
        const minHours = Math.min(...allHours);
        const maxHours = Math.max(...allHours);
        if (maxHours > minHours) {
          return normalize(currentHours, minHours, maxHours);
        }
        // Final: use index as tiebreaker
        const paperIndex = allMetrics.findIndex(m => (m as any).downloads_7d === downloads7d);
        if (paperIndex >= 0 && allMetrics.length > 1) {
          return 1 - (paperIndex / (allMetrics.length - 1));
        }
      }
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

  if (error) {
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }

  if (!metrics || metrics.length === 0) {
    return;
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
