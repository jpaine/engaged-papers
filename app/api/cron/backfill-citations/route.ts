import { NextResponse } from 'next/server';
import { fetchCitationCountsBatch } from '@/lib/semantic';
import { supabase } from '@/lib/supabase';
import { computeEngagementScoresForDate } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Backfill citation counts for all existing papers
 * This endpoint should be called manually to update all papers with citation data
 */
export async function GET() {
  try {
    // Get all papers
    const { data: papers, error: papersError } = await supabase
      .from('papers')
      .select('id')
      .order('published_at', { ascending: false });

    if (papersError) {
      throw papersError;
    }

    if (!papers || papers.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No papers found',
        updated: 0,
      });
    }

    const arxivIds = papers.map(p => p.id);
    console.log(`Fetching citation counts for ${arxivIds.length} papers...`);

    // Fetch citation counts in batches
    const citationCounts = await fetchCitationCountsBatch(arxivIds, 10, 300);

    const today = new Date().toISOString().split('T')[0];
    let updated = 0;
    let errors = 0;

    // Update metrics for each paper
    for (const paper of papers) {
      const citationCount = citationCounts.get(paper.id) || 0;

      // Check if metric exists for today
      const { data: existingMetric } = await supabase
        .from('paper_metrics')
        .select('id')
        .eq('paper_id', paper.id)
        .eq('snapshot_date', today)
        .single();

      if (existingMetric) {
        // Update existing metric
        const { error: updateError } = await supabase
          .from('paper_metrics')
          .update({
            downloads_total: citationCount,
            downloads_7d: citationCount,
          })
          .eq('id', existingMetric.id);

        if (updateError) {
          console.error(`Error updating metric for ${paper.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Insert new metric
        const { error: insertError } = await supabase
          .from('paper_metrics')
          .insert({
            paper_id: paper.id,
            snapshot_date: today,
            downloads_total: citationCount,
            downloads_7d: citationCount,
            github_repo_count: 0,
            engagement_score: 0,
          });

        if (insertError) {
          console.error(`Error inserting metric for ${paper.id}:`, insertError);
          errors++;
        } else {
          updated++;
        }
      }
    }

    // Recompute engagement scores for today
    await computeEngagementScoresForDate(today);

    return NextResponse.json({
      ok: true,
      papersProcessed: papers.length,
      updated,
      errors,
      message: `Updated ${updated} papers with citation data`,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
