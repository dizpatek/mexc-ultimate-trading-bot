import { NextResponse } from "next/server";
import { getOpenOrders } from "@/lib/mexc-wrapper";
import { getSessionUser } from "@/lib/auth-utils";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const openOrders = await getOpenOrders(user.id);

     
    const orders = ((openOrders as any[]) || []).map(
      (order: any, index: number) => {
        // Handle both MexcOrder and SimulatedOrder types
        const price =
          typeof order.price === "number"
            ? order.price
            : parseFloat(String(order.price || "0"));
        const qty =
          "origQty" in order
            ? parseFloat(order.origQty || "0")
            : "quantity" in order
              ? (order.quantity as number)
              : 0;
        const time =
          "time" in order
            ? order.time
            : "createdAt" in order
              ? (order.createdAt as number)
              : Date.now();

        return {
          id: String(index + 1),
          symbol: order.symbol,
          type: order.side.toLowerCase(),
          price,
          amount: qty,
          total: price * qty,
          time: new Date(time).toISOString(),
          status: order.status.toLowerCase(),
        };
      },
    );

    return NextResponse.json(orders);
  } catch (error: unknown) {
    console.error("Error fetching open orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch open orders" },
      { status: 500 },
    );
  }
}
