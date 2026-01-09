"use client";

import { useState } from 'react';
import { Power, Shield, Zap, TrendingUp, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const AutopilotPanel = () => {
    const queryClient = useQueryClient();
    const [isConfirming, setIsConfirming] = useState(false);

    const { data: status, isLoading } = useQuery({
        queryKey: ['autopilot-status'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/autopilot/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        refetchInterval: 10000 // Refresh every 10s
    });

    const toggleMutation = useMutation({
        mutationFn: async (active: boolean) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/autopilot/toggle', { active }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
            setIsConfirming(false);
        }
    });

    if (isLoading) return <div className="stat-card animate-pulse h-64 flex items-center justify-center">Loading Autopilot...</div>;

    const isActive = status?.active;
    const currentPhase = status?.currentPhase;
    const progress = status?.progress || 0;
    const allPhases = status?.allPhases || [];

    const getPhaseIcon = (index: number) => {
        switch (index) {
            case 0: return <Shield className="w-5 h-5" />;
            case 1: return <TrendingUp className="w-5 h-5" />;
            case 2: return <Zap className="w-5 h-5" />;
            case 3: return <Clock className="w-5 h-5" />;
            default: return <Activity className="w-5 h-5" />;
        }
    };

    return (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Control Panel */}
            <div className={`stat-card lg:col-span-1 flex flex-col justify-between transition-all duration-500 ${isActive ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}>
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl transition-colors ${isActive ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                                <Power className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl">Auto Pilot</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        {isActive ? 'System Online' : 'System Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-8">
                        The autopilot manages your 4-month investment cycle by automatically switching between specialized trading phases.
                    </p>
                </div>

                {!isConfirming ? (
                    <button
                        onClick={() => setIsConfirming(true)}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${isActive
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
                            }`}
                    >
                        {isActive ? 'SHUTDOWN AUTO PILOT' : 'ACTIVATE AUTO PILOT'}
                    </button>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsConfirming(false)}
                            className="flex-1 py-4 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => toggleMutation.mutate(!isActive)}
                            className={`flex-1 py-4 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 ${isActive ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20'
                                }`}
                        >
                            Confirm
                        </button>
                    </div>
                )}
            </div>

            {/* Current Phase & Progress */}
            <div className="stat-card lg:col-span-2 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-1">Current Process</h3>
                            <h2 className="text-2xl font-bold">{isActive && currentPhase ? currentPhase.name : 'Waiting for Launch'}</h2>
                        </div>
                        {isActive && (
                            <div className="text-right">
                                <span className="text-3xl font-black text-primary">{Math.round(progress)}%</span>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Progress</p>
                            </div>
                        )}
                    </div>

                    {isActive && currentPhase ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Strategy Profile</span>
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" />
                                        <span className="font-bold uppercase text-sm">{currentPhase.strategyType} Optimizer</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Time Remaining</span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary" />
                                        <span className="font-bold text-sm">{currentPhase.remainingDays} Days Left in Phase</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-muted-foreground italic text-sm">
                                "{currentPhase.description}"
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground max-w-xs px-4">
                                When you activate Auto Pilot, the system will begin the first of four sequential phases.
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-8">
                    {/* Phase Timeline */}
                    <div className="relative pt-4">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between mt-4">
                            {allPhases.map((phase: any, idx: number) => {
                                const isPast = isActive && currentPhase && currentPhase.index > idx;
                                const isCurrent = isActive && currentPhase && currentPhase.index === idx;
                                return (
                                    <div key={idx} className="flex flex-col items-center flex-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all ${isCurrent ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20' :
                                            isPast ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {isPast ? <CheckCircle2 className="w-5 h-5" /> : getPhaseIcon(idx)}
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase hidden md:block ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                                            Phase {idx + 1}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

import { Activity } from 'lucide-react';
