import { NextResponse } from 'next/server';
import { fetchRecentPapers } from '@/lib/arxiv';
import { searchRepoCountForArxivId } from '@/lib/github';
import { supabase, Paper, PaperMetric } from '@/lib/supabase';
import { computeEngagementScoresForDate } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const hoursBack = 24;
    const papers = await fetchRecentPapers(hoursBack);

    let inserted = 0;
    let updated = 0;

    const today = new Date().toISOString().split('T')[0];
    const metricsToInsert: Omit<PaperMetric, 'id'>[] = [];

    for (const arxivPaper of papers) {
      // Upsert paper
      const { error: paperError } = await supabase
        .from('papers')
        .upsert({
          id: arxivPaper.id,
          title: arxivPaper.title,
          abstract: arxivPaper.abstract,
          authors: arxivPaper.authors,
          categories: arxivPaper.categories,
          published_at: arxivPaper.published_at,
          updated_at: arxivPaper.updated_at,
        }, {
          onConflict: 'id',
        });

      if (paperError) {
        console.error(`Error upserting paper ${arxivPaper.id}:`, paperError);
        continue;
      }

      // Check if paper already existed
      const { data: existingPaper } = await supabase
        .from('papers')
        .select('created_at')
        .eq('id', arxivPaper.id)
        .single();

      if (existingPaper) {
        const createdAt = new Date(existingPaper.created_at);
        const now = new Date();
        const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreation < 1) {
          inserted++;
        } else {
          updated++;
        }
      } else {
        inserted++;
      }

      // Fetch GitHub repo count (optional, graceful if no token)
      const githubRepoCount = await searchRepoCountForArxivId(arxivPaper.id);

      // Check if metric for today already exists
      const { data: existingMetric } = await supabase
        .from('paper_metrics')
        .select('id')
        .eq('paper_id', arxivPaper.id)
        .eq('snapshot_date', today)
        .single();

      const metricData: Omit<PaperMetric, 'id'> = {
        paper_id: arxivPaper.id,
        snapshot_date: today,
        downloads_total: 0, // STUB
        downloads_7d: 0, // STUB
        github_repo_count: githubRepoCount,
        engagement_score: 0, // Will be computed after all metrics are inserted
      };

      if (existingMetric) {
        // Update existing metric
        const { error: metricError } = await supabase
          .from('paper_metrics')
          .update({
            downloads_total: metricData.downloads_total,
            downloads_7d: metricData.downloads_7d,
            github_repo_count: metricData.github_repo_count,
            engagement_score: metricData.engagement_score,
          })
          .eq('id', existingMetric.id);

        if (metricError) {
          console.error(`Error updating metric for ${arxivPaper.id}:`, metricError);
        }
      } else {
        // Insert new metric
        metricsToInsert.push(metricData);
      }
    }

    // Batch insert new metrics
    if (metricsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('paper_metrics')
        .insert(metricsToInsert);

      if (insertError) {
        console.error('Error inserting metrics:', insertError);
      }
    }

    // Recompute engagement scores for today (normalization across all papers)
    await computeEngagementScoresForDate(today);

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      papersProcessed: papers.length,
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
