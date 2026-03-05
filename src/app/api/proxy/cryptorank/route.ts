import { NextRequest, NextResponse } from "next/server";

const CRYPTORANK_ORIGIN = "https://cryptorank.io";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";

  const url = path
    ? `${CRYPTORANK_ORIGIN}${path}`
    : `${CRYPTORANK_ORIGIN}/watchlist/4f7effbd40d4`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        Referer: CRYPTORANK_ORIGIN,
      },
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();

      html = html.replace(
        /(src|href)=["']\/([^"']*)["']/g,
        (match, attr, p) => {
          if (
            p.startsWith("http") ||
            p.startsWith("data:") ||
            p.startsWith("//") ||
            p.startsWith("javascript:")
          )
            return match;
          return `${attr}="${CRYPTORANK_ORIGIN}/${p}"`;
        },
      );

      html = html.replace(
        /api\.cryptorank\.io/g,
        request.nextUrl.host + "/api/proxy/cryptorank",
      );

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const data = await response.text();
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType || "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
