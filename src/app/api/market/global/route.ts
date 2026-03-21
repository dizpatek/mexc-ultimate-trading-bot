import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import axios from "axios";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    // Remove hard 401 for global market data to allow guest/fallback viewing
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/global",
      {
        timeout: 15000,
      }
    );

    if (!response.data || !response.data.data) {
      return NextResponse.json({ error: "Empty response from provider" }, { status: 504 });
    }

    return NextResponse.json(response.data.data);
  } catch (error: unknown) {
    console.error("Error in global market dominance API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Failed to fetch global market data" },
      { status: 500 }
    );
  }
}
