import { sql } from '@vercel/postgres';

export interface Phase {
    name: string;
    durationDays: number;
    description: string;
    strategyType: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const TRADING_PHASES: Phase[] = [
    {
        name: 'Accumulation Phase',
        durationDays: 30,
        description: 'Buying quality assets at low prices. Low risk, long-term focus.',
        strategyType: 'rsi',
        riskLevel: 'LOW'
    },
    {
        name: 'Growth Phase',
        durationDays: 30,
        description: 'Capitalizing on market momentum. Medium risk, trend following.',
        strategyType: 'ma_crossover',
        riskLevel: 'MEDIUM'
    },
    {
        name: 'Expansion Phase',
        durationDays: 30,
        description: 'Maximizing profits during bull runs. Higher risk, volatile assets.',
        strategyType: 'macd',
        riskLevel: 'HIGH'
    },
    {
        name: 'Harvest Phase',
        durationDays: 30,
        description: 'Closing positions and securing gains. Risk reduction and exit.',
        strategyType: 'rsi',
        riskLevel: 'LOW'
    }
];

export async function getAutopilotStatus() {
    const { rows } = await sql`SELECT * FROM system_settings WHERE key = 'autopilot_active'`;
    const active = rows[0]?.value === 'true';

    const { rows: cycleRows } = await sql`
        SELECT * FROM trading_cycles 
        WHERE status = 'ACTIVE' 
        ORDER BY created_at DESC LIMIT 1
    `;

    const currentCycle = cycleRows[0] || null;
    let currentPhase = null;
    let progress = 0;

    if (currentCycle) {
        const now = Date.now();
        const start = parseInt(currentCycle.start_date);
        const end = parseInt(currentCycle.end_date);
        const totalDuration = end - start;
        const elapsed = now - start;

        progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        // Determine phase index based on elapsed time
        let accumulatedDays = 0;
        const elapsedDays = elapsed / (24 * 60 * 60 * 1000);

        for (let i = 0; i < TRADING_PHASES.length; i++) {
            accumulatedDays += TRADING_PHASES[i].durationDays;
            if (elapsedDays <= accumulatedDays) {
                currentPhase = {
                    ...TRADING_PHASES[i],
                    index: i,
                    remainingDays: Math.ceil(accumulatedDays - elapsedDays)
                };
                break;
            }
        }

        // Fallback for completion
        if (!currentPhase && elapsedDays > accumulatedDays) {
            currentPhase = { ...TRADING_PHASES[TRADING_PHASES.length - 1], index: TRADING_PHASES.length - 1, remainingDays: 0 };
        }
    }

    return {
        active,
        currentCycle,
        currentPhase,
        progress,
        allPhases: TRADING_PHASES
    };
}

export async function startAutopilot() {
    const now = Date.now();
    const fourMonthsMs = 120 * 24 * 60 * 60 * 1000;
    const endDate = now + fourMonthsMs;

    // Start a new cycle
    const { rows } = await sql`
        INSERT INTO trading_cycles (name, start_date, end_date, status, current_phase_index, created_at)
        VALUES ('Automated 4-Month Cycle', ${now}, ${endDate}, 'ACTIVE', 0, ${now})
        RETURNING id
    `;

    const cycleId = rows[0].id;

    // Update settings
    await sql`UPDATE system_settings SET value = 'true', updated_at = ${now} WHERE key = 'autopilot_active'`;
    await sql`UPDATE system_settings SET value = ${cycleId.toString()}, updated_at = ${now} WHERE key = 'current_cycle_id'`;

    return { success: true, cycleId };
}

export async function stopAutopilot() {
    const now = Date.now();
    await sql`UPDATE system_settings SET value = 'false', updated_at = ${now} WHERE key = 'autopilot_active'`;
    await sql`UPDATE trading_cycles SET status = 'CANCELLED' WHERE status = 'ACTIVE'`;
    return { success: true };
}
