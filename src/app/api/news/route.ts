import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { fetchAndProcessNews } from "@/services/newsService";

export const revalidate = 300; // Cache the response for 5 minutes (300 seconds)

export async function GET(request: Request) {
  try {
    // News API is now public to prevent 401 errors during session transitions
    // const user = await getSessionUser(request);
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    const news = await fetchAndProcessNews(force);
    return NextResponse.json(news);
  } catch (error) {
    console.error("API Route Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 },
    );
  }
}
