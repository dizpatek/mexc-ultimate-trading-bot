/**
 * API Route: /api/agent
 * GET  → Ajan durumu, konuşma logu ve önerileri döner
 * POST → Aksiyon: "run" (görev çalıştır) | "approve" | "clear_suggestions"
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runAgentTask,
  getAgentStatus,
  getConversationLog,
  getSuggestions,
  approveSuggestion,
  clearSuggestions,
  type AgentTaskType,
} from "@/lib/autonomous-agent";

export const dynamic = "force-dynamic";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const status = getAgentStatus();
    const conversationLog = getConversationLog();
    const suggestions = getSuggestions();

    return NextResponse.json({
      ok: true,
      status,
      conversationLog,
      suggestions,
    });
  } catch (e) {
    console.error("[Agent API] GET error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string;
      taskType?: AgentTaskType;
      suggestionId?: string;
      extraContext?: Record<string, unknown>;
    };
    const { action } = body;

    switch (action) {
      // Yeni bir ajan görevi başlat (background'da çalışır, timeout döner)
      case "run": {
        const { taskType = "error_analysis", extraContext } = body;

        // Arka planda çalıştır — API cevabı bekletme
        runAgentTask(taskType, extraContext).catch((err) => {
          console.error("[Agent API] Task error:", err);
        });

        return NextResponse.json({
          ok: true,
          message: `✅ Görev başlatıldı: ${taskType}`,
          taskType,
        });
      }

      // Bir öneriyi onayla (AutonomousExecutor'ı tetikler)
      case "approve": {
        const { suggestionId } = body;
        if (!suggestionId) {
          return NextResponse.json(
            { ok: false, error: "suggestionId belirtilmedi." },
            { status: 400 }
          );
        }
        const result = approveSuggestion(suggestionId);
        return NextResponse.json(result);
      }

      // Tüm önerileri temizle
      case "clear_suggestions": {
        clearSuggestions();
        return NextResponse.json({
          ok: true,
          message: "Tüm öneriler temizlendi.",
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Bilinmeyen aksiyon: ${action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    console.error("[Agent API] POST error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}