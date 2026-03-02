"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { TimeframeProvider } from '../context/TimeframeContext';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <TimeframeProvider>
                    {children}
                </TimeframeProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
