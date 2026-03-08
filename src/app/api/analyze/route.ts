import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { fetchGroqAnalysis } from "@/lib/ai-provider";
import { getSetting, setSetting } from "@/lib/settings";
import { runFullOrchestraAnalysis, buildOrchestraPrompt } from "@/lib/orchestrator-analysis";

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.is_admin === true;

    const now = Date.now();
    // Rate limit: admin users bypass completely
    if (!isAdmin) {
      const dbLastCallStr = await getSetting("GROQ_LAST_CALL", user.id);
      const lastCallTime = dbLastCallStr ? parseInt(dbLastCallStr, 10) : 0;
      const timeSinceLastCall = now - lastCallTime;
      
      if (timeSinceLastCall < RATE_LIMIT_MS) {
        const remainingSecs = Math.ceil((RATE_LIMIT_MS - timeSinceLastCall) / 1000);
        return NextResponse.json(
          { error: `Rate limit active. Please wait ${remainingSecs} seconds.`, isAdmin: false },
          { status: 429 }
        );
      }
    }

    const { prompt, symbol, timeframe, isMeme, dashboardState } = await request.json();

    if (prompt) {
       // Legacy / direct prompt override
       const data = await fetchGroqAnalysis(prompt);
       await setSetting("GROQ_LAST_CALL", Date.now().toString(), user.id);
       return NextResponse.json({ result: data });
    }

    if (!symbol || !timeframe) {
      return NextResponse.json({ error: "Symbol and timeframe are required" }, { status: 400 });
    }

    // Run backend analysis (fetches from MEXC via backend to avoid CORS)
    const { data: rawData } = await runFullOrchestraAnalysis(symbol, timeframe, isMeme);
    const generatedPrompt = buildOrchestraPrompt(symbol, timeframe, rawData, isMeme, dashboardState);

    const result = await fetchGroqAnalysis(generatedPrompt);
    
    // Update the persistent rate limit upon successful generation
    await setSetting("GROQ_LAST_CALL", Date.now().toString(), user.id);
    
    return NextResponse.json({ 
      result, 
      rawData: dashboardState ? { ...rawData, dashboardState } : rawData, 
      isAdmin 
    });
  } catch (error: unknown) {
    console.error("AI Analysis failed:", error);
    return NextResponse.json(
      { error: `Failed to process AI analysis: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
