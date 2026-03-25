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

// Google Client ID explicitly hardcoded to prevent Next.js build-time ENV issues on PaaS
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "36399774172-i0sahmhr5l1c4a9okogiqjau9ijevo9h.apps.googleusercontent.com";

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
