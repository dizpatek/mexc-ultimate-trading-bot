import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import type { User } from "@/lib/db";
import { DiagnosticsService } from "@/lib/diagnostics";

export async function GET(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");

  try {
    if (table) {
      const rows = await DiagnosticsService.getTableData(table);
      return NextResponse.json({ success: true, rows });
    }

    const results = await Promise.allSettled([
      DiagnosticsService.getSystemAudit(user.id),
      DiagnosticsService.getPilotHub(user.id),
      DiagnosticsService.getPortfolioGuardian(user.id),
      DiagnosticsService.getPerformance(user.id),
      DiagnosticsService.getMaintenance(user.id),
      DiagnosticsService.getDbStatus(),
      DiagnosticsService.getDeploymentStatus(),
      DiagnosticsService.getWorkerHeartbeat(),
      DiagnosticsService.getLiveLogs(50),
      DiagnosticsService.getAllUsers(),
      DiagnosticsService.getTables()
    ]);

    const data = {
      system: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
      pilot: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
      portfolio: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason },
      performance: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason },
      maintenance: results[4].status === 'fulfilled' ? results[4].value : { error: results[4].reason },
      db: results[5].status === 'fulfilled' ? results[5].value : { error: results[5].reason },
      deployment: results[6].status === 'fulfilled' ? results[6].value : { error: results[6].reason },
      worker: results[7].status === 'fulfilled' ? results[7].value : { error: results[7].reason },
      logs: results[8].status === 'fulfilled' ? results[8].value : { error: results[8].reason },
      users: results[9].status === 'fulfilled' ? results[9].value : { error: results[9].reason },
      tables: results[10].status === 'fulfilled' ? results[10].value : { error: results[10].reason }
    };

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: unknown) {
    console.error("[DiagnosticsAPI] Failed to fetch audit:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    // 1. User Actions
    if (action === 'toggle_admin') {
      const { userId, isAdmin } = body;
      const result = await DiagnosticsService.toggleAdmin(userId, isAdmin);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'purge_user') {
      const { userId } = body;
      const result = await DiagnosticsService.purgeUser(userId);
      return NextResponse.json({ success: true, result });
    }

    // 2. DB Explorer Actions
    if (action === 'delete_row') {
      const { table, id } = body;
      const result = await DiagnosticsService.deleteRecord(table, id);
      return NextResponse.json({ success: true, result });
    }

    // 3. System Actions
    if (action === 'cleanup') {
      const result = await DiagnosticsService.runForceCleanup(user.id);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'trigger_signal') {
      const { symbol, type, targetUserId } = body;
      if (!symbol || !type) {
        return NextResponse.json({ error: "Symbol and type are required" }, { status: 400 });
      }
      const result = await DiagnosticsService.triggerSignal(symbol, type, targetUserId || user.id);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
