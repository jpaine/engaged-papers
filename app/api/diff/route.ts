import { NextResponse } from 'next/server';
import { supabase, PaperWithMetrics } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get new papers (created in last 24h)
    const { data: newPapersData, error: newPapersError } = await supabase
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
      `)
      .gte('created_at', last24h.toISOString())
      .order('created_at', { ascending: false });

    if (newPapersError) {
      throw newPapersError;
    }

    // Get papers with metrics from last 7 days
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('paper_metrics')
      .select(`
        *,
        papers(*)
      `)
      .gte('snapshot_date', last7d.toISOString().split('T')[0])
      .order('engagement_score', { ascending: false });

    if (metricsError) {
      throw metricsError;
    }

    // Process new papers with latest metrics
    const newPapers: PaperWithMetrics[] = (newPapersData || []).map(paper => {
      const metrics = paper.paper_metrics;
      let latestMetric = undefined;
      
      if (Array.isArray(metrics) && metrics.length > 0) {
        latestMetric = metrics.reduce((latest, current) => {
          return new Date(current.snapshot_date) > new Date(latest.snapshot_date)
            ? current
            : latest;
        });
      }

      return {
        ...paper,
        metrics: latestMetric,
      };
    });

    // Get top 10% by score from last 7 days
    const allScores = (recentMetrics || [])
      .map(m => m.engagement_score)
      .filter(s => s > 0)
      .sort((a, b) => b - a);

    const top10PercentIndex = Math.ceil(allScores.length * 0.1);
    const threshold = allScores[top10PercentIndex - 1] || 0;

    const risingPapers: PaperWithMetrics[] = (recentMetrics || [])
      .filter(m => m.engagement_score >= threshold)
      .slice(0, Math.ceil(allScores.length * 0.1))
      .map(m => ({
        ...m.papers,
        metrics: {
          snapshot_date: m.snapshot_date,
          downloads_total: m.downloads_total,
          downloads_7d: m.downloads_7d,
          github_repo_count: m.github_repo_count,
          engagement_score: m.engagement_score,
        },
      })) as PaperWithMetrics[];

    return NextResponse.json({
      newPapers,
      risingPapers,
    });
  } catch (error) {
    console.error('Diff API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
