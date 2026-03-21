import { NextResponse } from "next/server";
import { fetchAndProcessNews } from "@/services/newsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await fetchAndProcessNews();
    return NextResponse.json({
        success: true,
        count: news.length,
        items: news.slice(0, 3) 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
