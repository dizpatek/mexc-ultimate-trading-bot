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

    const [system, pilot, portfolio, performance, maintenance, db, deployment, worker, logs, users, tables] = await Promise.all([
      DiagnosticsService.getSystemAudit(),
      DiagnosticsService.getPilotHub(user.id),
      DiagnosticsService.getPortfolioGuardian(user.id),
      DiagnosticsService.getPerformance(user.id),
      DiagnosticsService.getMaintenance(),
      DiagnosticsService.getDbStatus(),
      DiagnosticsService.getDeploymentStatus(),
      DiagnosticsService.getWorkerHeartbeat(),
      DiagnosticsService.getLiveLogs(50),
      DiagnosticsService.getAllUsers(),
      DiagnosticsService.getTables()
    ]);

    return NextResponse.json({
      success: true,
      data: { system, pilot, portfolio, performance, maintenance, db, deployment, worker, logs, users, tables }
    });
  } catch (error: unknown) {
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
