import { NextResponse } from 'next/server';
import { computeEngagementScoresForDate } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Recalculate engagement scores for all papers
 * This endpoint recalculates scores using the latest scoring logic
 */
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Recompute scores for today
    await computeEngagementScoresForDate(today);
    
    return NextResponse.json({
      ok: true,
      message: `Recalculated engagement scores for ${today}`,
    });
  } catch (error) {
    console.error('Recalculation error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
