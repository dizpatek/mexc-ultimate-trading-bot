"use client";

import { useState, useEffect } from "react";
import { 
  Activity, 
  Database, 
  ShieldCheck, 
  TrendingUp, 
  Hammer, 
  Box, 
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { api } from "@/services/api";

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/diagnostics");
      setData(res.data.data);
      setError(null);
    } catch (err) {
      setError("Failed to load diagnostics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  if (loading && !data) return (
    <div className="flex items-center justify-center p-12">
      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
      <AlertCircle className="w-5 h-5" /> {error}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black italic tracking-tighter text-primary">ADMIN COMMAND CENTER</h2>
        <button onClick={fetchDiagnostics} className="btn-outline !p-2 rounded-full hover:rotate-180 transition-all duration-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Audit Card */}
        <DiagCard title="SYSTEM AUDIT" icon={<Activity className="text-blue-400" />} status={data?.system?.drift < 5000 ? 'healthy' : 'warning'}>
          <div className="space-y-1 text-[10px] font-mono">
            <p>DB: <span className="text-white">{data?.system?.dbVersion}</span></p>
            <p>DRIFT: <span className={data?.system?.drift > 5000 ? 'text-red-500' : 'text-green-500'}>{data?.system?.drift}ms</span></p>
            <div className="flex flex-wrap gap-1 mt-2">
              {data?.system?.tableStatus.map((t: any) => (
                <span key={t.name} className={`px-1 rounded ${t.exists ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{t.name}</span>
              ))}
            </div>
          </div>
        </DiagCard>

        {/* Portfolio Guardian Card */}
        <DiagCard title="PORTFOLIO" icon={<ShieldCheck className="text-green-400" />} status={data?.portfolio?.anomalies.length === 0 ? 'healthy' : 'error'}>
          <div className="space-y-1 text-[10px] font-mono">
            <p>HOLDINGS: <span className="text-white">{data?.portfolio?.holdings.length}</span></p>
            <p>ANOMALIES: <span className={data?.portfolio?.anomalies.length > 0 ? 'text-red-500' : 'text-green-500'}>{data?.portfolio?.anomalies.length}</span></p>
            {data?.portfolio?.anomalies.map((a: any, i: number) => (
              <p key={i} className="text-red-400">❌ {a.symbol} missing</p>
            ))}
          </div>
        </DiagCard>

        {/* Performance Card */}
        <DiagCard title="PERFORMANCE" icon={<TrendingUp className="text-primary" />} status="healthy">
          <div className="space-y-1 text-[10px] font-mono text-center">
             <div className="text-2xl font-black text-white">% {data?.performance?.winRate.toFixed(1)}</div>
             <p className="text-muted-foreground uppercase tracking-widest text-[8px]">WIN RATE (L30)</p>
             <p className="mt-2 text-primary">Total: {data?.performance?.total} trades</p>
          </div>
        </DiagCard>

        {/* Maintenance Card */}
        <DiagCard title="MAINTENANCE" icon={<Hammer className="text-yellow-400" />} status={data?.maintenance?.duplicates.length === 0 ? 'healthy' : 'warning'}>
          <div className="space-y-1 text-[10px] font-mono">
            <p>DUPLICATES: <span className="text-white">{data?.maintenance?.duplicates.length}</span></p>
            <p>INDEXES: <span className="text-green-500">{data?.maintenance?.indexHealth ? 'OPTIMIZED' : 'EKSİK'}</span></p>
          </div>
        </DiagCard>

        {/* DB Orchestrator */}
        <DiagCard title="DATABASE" icon={<Database className="text-purple-400" />} status={data?.db?.schemaFileExists ? 'healthy' : 'error'}>
          <div className="space-y-1 text-[10px] font-mono">
            <p>USERS: <span className="text-white">{data?.db?.userCount}</span></p>
            <p>SCHEMA SQL: <span className="text-green-500">{data?.db?.schemaFileExists ? 'FOUND' : 'MISSING'}</span></p>
          </div>
        </DiagCard>

        {/* Deployment Hub */}
        <DiagCard title="DEPLOYMENT" icon={<Globe className="text-cyan-400" />} status={data?.deployment?.nfConfigured ? 'healthy' : 'warning'}>
          <div className="space-y-1 text-[10px] font-mono text-xs">
            <p>NF CONFIG: {data?.deployment?.nfConfigured ? '✅' : '❌'}</p>
            <p>DOCKER: {data?.deployment?.dockerReady ? '✅' : '❌'}</p>
            <p>ENV: {data?.deployment?.envFound ? '✅' : '❌'}</p>
          </div>
        </DiagCard>

        {/* Pilot Hub */}
        <DiagCard title="PILOT HUB" icon={<Box className="text-red-400" />} status={data?.pilot?.config?.auto_trade ? 'healthy' : 'warning'}>
          <div className="space-y-1 text-[10px] font-mono">
            <p>MODE: <span className="text-white">{data?.pilot?.config?.pilot_mode?.toUpperCase()}</span></p>
            <p>TF: {data?.pilot?.config?.pilot_timeframe}</p>
            <p className="mt-2 text-[8px] opacity-50 uppercase">Last Signal:</p>
            <p className="text-primary">{data?.pilot?.recentSignals[0]?.symbol} ({data?.pilot?.recentSignals[0]?.type})</p>
          </div>
        </DiagCard>
      </div>
    </div>
  );
}

function DiagCard({ title, icon, status, children }: { title: string, icon: any, status: 'healthy' | 'warning' | 'error', children: any }) {
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  return (
    <div className="stat-card group hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-1 h-full ${statusColors[status]} opacity-30`} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/5 rounded-lg group-hover:bg-primary/5 transition-colors">
            {icon}
          </div>
          <h3 className="text-xs font-black tracking-widest uppercase italic">{title}</h3>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status]} shadow-[0_0_8px] ${status === 'healthy' ? 'shadow-green-500' : status === 'warning' ? 'shadow-yellow-500' : 'shadow-red-500'}`} />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
