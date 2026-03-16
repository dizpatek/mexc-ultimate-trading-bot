"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { TimeframeProvider } from "../context/TimeframeContext";
import { TradeProvider } from "../context/TradeContext";
import { NotificationProvider } from "../context/NotificationContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import TopToasts from "./ui/TopToasts";
import ConfirmDialog from "./ui/ConfirmDialog";

// Google Client ID from environment variables
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "placeholder-id";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
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
    </GoogleOAuthProvider>
  );
}
