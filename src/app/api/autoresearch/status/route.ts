import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. En İyi Deney (Best Experiment)
    const { rows: bestRows } = await sql`
      SELECT composite_score, params, win_rate, total_trades, total_pnl_pct, search_phase
      FROM autoresearch_experiments
      WHERE is_best = true
      ORDER BY composite_score DESC
      LIMIT 1
    `;
    const bestExperiment = bestRows[0] || null;

    // 2. En Son Deney (Latest Experiment)
    const { rows: latestRows } = await sql`
      SELECT id as experiment_num, composite_score, search_phase, params
      FROM autoresearch_experiments
      ORDER BY id DESC
      LIMIT 1
    `;
    const latestExperiment = latestRows[0] || null;

    // 3. Toplam Deney Sayısı (Experiment Count)
    const { rows: countRows } = await sql`
      SELECT COUNT(*) as total FROM autoresearch_experiments
    `;
    const totalExperiments = Number(countRows[0]?.total || 0);

    // 4. Son AI Araştırma Raporu (Insight)
    const { rows: aiRows } = await sql`
      SELECT details, timestamp
      FROM system_logs
      WHERE message = '🤖 AI Araştırma Raporu'
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const latestAiInsight = aiRows[0]?.details || null;

    return NextResponse.json({
      bestExperiment,
      latestExperiment,
      totalExperiments,
      latestAiInsight
    });
  } catch (error) {
    console.error('[API] AutoResearch Status query failed:', error);
    return NextResponse.json({ error: 'Failed to fetch AutoResearch status' }, { status: 500 });
  }
}
