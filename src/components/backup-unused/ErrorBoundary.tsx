"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[ErrorBoundary] Error in ${this.props.componentName || 'component'}:`, error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <h3 className="font-semibold text-destructive">Something went wrong</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {this.props.componentName ? `Failed to load ${this.props.componentName}` : 'A component failed to render.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="text-xs text-primary hover:underline mt-2"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
