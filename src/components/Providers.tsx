"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { TimeframeProvider } from "../context/TimeframeContext";
import { TradeProvider } from "../context/TradeContext";
import { NotificationProvider } from "../context/NotificationContext";
import TopToasts from "./ui/TopToasts";
import ConfirmDialog from "./ui/ConfirmDialog";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <AuthProvider>
          <TimeframeProvider>
            <TradeProvider>{children}</TradeProvider>
          </TimeframeProvider>
        </AuthProvider>
        <TopToasts />
        <ConfirmDialog />
      </NotificationProvider>
    </QueryClientProvider>
  );
}
