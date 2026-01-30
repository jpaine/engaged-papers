import { NextRequest, NextResponse } from 'next/server';
import { supabase, PaperWithMetrics } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const category = searchParams.get('category');
    const minScore = parseFloat(searchParams.get('minScore') || '0');

    // Build query - use left join to include papers without metrics
    let query = supabase
      .from('papers')
      .select(`
        *,
        paper_metrics(
          snapshot_date,
          downloads_total,
          downloads_7d,
          github_repo_count,
          engagement_score
        )
      `);

    // Filter by date (last 7 days if not specified)
    const dateFilter = fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    query = query.gte('published_at', dateFilter);

    // Filter by category
    if (category) {
      query = query.contains('categories', [category]);
    }

    // Get papers with metrics
    const { data: papers, error } = await query.order('published_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Process to get latest metrics per paper
    const papersWithLatestMetrics: PaperWithMetrics[] = [];
    const paperMap = new Map<string, PaperWithMetrics>();

    for (const paper of papers || []) {
      const paperId = paper.id;
      
      if (!paperMap.has(paperId)) {
        paperMap.set(paperId, {
          ...paper,
          metrics: undefined,
        });
      }

      const paperEntry = paperMap.get(paperId)!;
      const metrics = paper.paper_metrics;
      
      if (Array.isArray(metrics) && metrics.length > 0) {
        // Find latest metric by snapshot_date
        const latestMetric = metrics.reduce((latest, current) => {
          return new Date(current.snapshot_date) > new Date(latest.snapshot_date)
            ? current
            : latest;
        });

        if (!paperEntry.metrics || 
            new Date(latestMetric.snapshot_date) > new Date(paperEntry.metrics.snapshot_date)) {
          paperEntry.metrics = latestMetric;
        }
      }
    }

    // Filter by minScore on latest metrics (only if minScore > 0)
    let filtered = Array.from(paperMap.values());
    if (minScore > 0) {
      filtered = filtered.filter(paper => {
        if (!paper.metrics) {
          return false; // Exclude papers without metrics if filtering by score
        }
        return paper.metrics.engagement_score >= minScore;
      });
    }

    // Sort by engagement score descending
    filtered.sort((a, b) => {
      const scoreA = a.metrics?.engagement_score || 0;
      const scoreB = b.metrics?.engagement_score || 0;
      return scoreB - scoreA;
    });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
