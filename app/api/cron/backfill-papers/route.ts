import { NextResponse } from 'next/server';
import { fetchPapersByDateRange } from '@/lib/arxiv';
import { fetchCitationCountsBatch } from '@/lib/semantic';
import { supabase, Paper, PaperMetric } from '@/lib/supabase';
import { computeEngagementScoresForDate } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    // Allow optional date range via query params, default to last 7 days for testing
    const url = new URL(request.url);
    const daysBack = parseInt(url.searchParams.get('days') || '7');
    const customStart = url.searchParams.get('startDate');
    
    let startDate: Date;
    let endDate = new Date();
    
    if (customStart) {
      startDate = new Date(customStart);
    } else {
      // Default: last N days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
    }
    
    console.log(`Backfill: startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}, daysBack=${daysBack}`);
    
    console.log(`Starting backfill from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
    
    // Fetch all papers in the date range
    const papers = await fetchPapersByDateRange(startDate, endDate);
    console.log(`Found ${papers.length} papers to process`);

    let inserted = 0;
    let updated = 0;

    const today = new Date().toISOString().split('T')[0];
    const metricsToInsert: Omit<PaperMetric, 'id'>[] = [];

    // Fetch citation counts for all papers (with rate limiting)
    const arxivIds = papers.map(p => p.id);
    console.log(`Fetching citation counts for ${arxivIds.length} papers...`);
    const citationCounts = await fetchCitationCountsBatch(arxivIds, 1, 3000); // Sequential with 3s delay

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

      // Check if metric for today already exists
      const { data: existingMetric } = await supabase
        .from('paper_metrics')
        .select('id')
        .eq('paper_id', arxivPaper.id)
        .eq('snapshot_date', today)
        .single();

      // Get citation count from Semantic Scholar
      const citationCount = citationCounts.get(arxivPaper.id) || 0;

      const metricData: Omit<PaperMetric, 'id'> = {
        paper_id: arxivPaper.id,
        snapshot_date: today,
        downloads_total: citationCount,
        downloads_7d: citationCount,
        github_repo_count: 0,
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

    // Recompute engagement scores for today
    await computeEngagementScoresForDate(today);

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      papersProcessed: papers.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
