"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  Cpu, 
  ShieldAlert, 
  Zap, 
  HardDrive, 
  Globe, 
  Activity, 
  RefreshCw, 
  Trash2, 
  Send,
  Database,
  Layers,
  Search,
  Users,
  Eye,
  Settings2,
  ChevronRight,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { api } from "@/services/api";
import { useNotification } from "@/context/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";

type Tab = 'command' | 'intelligence' | 'nexus' | 'actions' | 'announcer' | 'toolbox';

export function AdminArsenal() {
  const [activeTab, setActiveTab ] = useState<Tab>('command');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { notify, confirm } = useNotification();
  const logEndRef = useRef<HTMLDivElement>(null);

  // Nexus Explorer States
  const [selectedTable, setSelectedTable] = useState<{name: string, schema: string} | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/diagnostics");
      setData(res.data.data);
      if (!selectedTable && res.data.data.tables.length > 0) {
        const first = res.data.data.tables[0];
        setSelectedTable({ name: first.table_name, schema: first.table_schema });
      }
    } catch (err) {
      notify("Failed to load arsenal data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string, schema: string) => {
    setTableLoading(true);
    try {
      const res = await api.get(`/admin/diagnostics?table=${tableName}&schema=${schema}`);
      setTableData(res.data.rows);
    } catch (err) {
      notify(`Failed to fetch table: ${schema}.${tableName}`, "error");
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'nexus' && selectedTable) {
      fetchTableData(selectedTable.name, selectedTable.schema);
    }
  }, [selectedTable, activeTab]);

  const handleAction = async (action: string, payload: any = {}) => {
    setActionLoading(action);
    try {
      const res = await api.post("/admin/diagnostics", { action, ...payload });
      if (res.data.success) {
        notify(`Action successful: ${action}`, "success");
        fetchData();
        if (activeTab === 'nexus' && selectedTable) fetchTableData(selectedTable.name, selectedTable.schema);
      }
    } catch (err) {
      notify(`Action failed: ${action}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeUser = (userId: number, username: string) => {
    confirm({
        message: `ARE YOU SURE? This will PURGE ALL DATA for user ${username.toUpperCase()} (ID: ${userId}) including orders, portfolio, and settings. This cannot be undone.`,
        onConfirm: () => handleAction('purge_user', { userId })
    });
  };

  const handleDeleteRow = (id: any) => {
    if (!selectedTable) return;
    confirm({
        message: `Delete row with ID ${id} from table ${selectedTable.schema}.${selectedTable.name}?`,
        onConfirm: () => handleAction('delete_row', { table: selectedTable.name, schema: selectedTable.schema, id })
    });
  };

  if (!data && loading) return <div className="p-12 text-center text-primary animate-pulse font-black italic">GOD MODE ACTIVATING...</div>;

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-primary/20 bg-black/20 p-6 rounded-3xl backdrop-blur-xl border-white/5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-[0_0_20px_rgba(255,231,0,0.1)]">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-black italic tracking-tighter text-primary">ARSENAL <span className="text-white">v3.0</span></h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.4em]">God Mode Interface</p>
          </div>
        </div>

        <nav className="flex gap-1 p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
           <TabButton active={activeTab === 'command'} onClick={() => setActiveTab('command')} label="NUCLEUS" icon={<Activity className="w-3.5 h-3.5" />} />
           <TabButton active={activeTab === 'intelligence'} onClick={() => setActiveTab('intelligence')} label="INTEL" icon={<Users className="w-3.5 h-3.5" />} />
           <TabButton active={activeTab === 'announcer'} onClick={() => setActiveTab('announcer')} label="ANNOUNCER" icon={<Send className="w-3.5 h-3.5" />} />
           <TabButton active={activeTab === 'nexus'} onClick={() => setActiveTab('nexus')} label="NEXUS DB" icon={<Database className="w-3.5 h-3.5" />} />
           <TabButton active={activeTab === 'actions'} onClick={() => setActiveTab('actions')} label="COMMAND" icon={<Zap className="w-3.5 h-3.5" />} />
           <TabButton active={activeTab === 'toolbox'} onClick={() => setActiveTab('toolbox')} label="TOOLBOX" icon={<Terminal className="w-3.5 h-3.5" />} />
        </nav>

        <button onClick={fetchData} className="btn-outline !p-3 rounded-xl border-white/10 hover:bg-primary/5">
           <RefreshCw className={`w-5 h-5 text-primary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
           animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
           exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
           transition={{ duration: 0.3 }}
           className="min-h-[600px]"
        >
          {activeTab === 'command' && <CommandCenterTab data={data} />}
          {activeTab === 'intelligence' && <IntelligenceTab users={data?.users} onPurge={handlePurgeUser} onAction={handleAction} actionLoading={actionLoading} />}
          {activeTab === 'announcer' && <AnnouncerTab users={data?.users} onAction={handleAction} actionLoading={actionLoading} />}
          {activeTab === 'nexus' && (
             <NexusTab 
               tables={data?.tables} 
               selectedTable={selectedTable} 
               data={tableData} 
               loading={tableLoading} 
               onTableSelect={(name: string, schema: string) => setSelectedTable({ name, schema })} 
               onDeleteRow={handleDeleteRow}
               actionLoading={actionLoading}
             />
          )}
          {activeTab === 'toolbox' && <ToolboxTab users={data?.users} />}
          {activeTab === 'actions' && (
             <div className="space-y-6">
                <section className="stat-card border-red-500/20 bg-red-500/[0.01]">
                   <h3 className="text-xs font-black tracking-widest uppercase mb-6 flex items-center gap-2 text-red-500">
                      <Zap className="w-4 h-4" /> Global Signal Injection
                   </h3>
                   <AdvancedSignalStation 
                     users={data?.users} 
                     onTrigger={(s: string, t: string, u: string | number) => handleAction('trigger_signal', { symbol: s, type: t, targetUserId: u })}
                     loading={actionLoading === 'trigger_signal'}
                   />
                </section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <CardAction label="FORCE CLEANUP" desc="Veritabanındaki mükerrer doldurulmuş emirleri temizler (Side bazlı)." icon={<Trash2 />} onClick={() => handleAction('cleanup')} loading={actionLoading === 'cleanup'} />
                   <CardAction label="RESET SIMULATOR" desc="Bütün simülatör verilerini (USDT dahil) fabrikaya döndürür." icon={<RefreshCw />} onClick={() => handleAction('reset_portfolio', { userId: 'ALL' })} color="border-red-500/30 text-red-500" />
                </div>
             </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

function TabButton({ active, onClick, label, icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,231,0,0.3)]' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
    >
      {icon} {label}
    </button>
  );
}

// 1. COMMAND CENTER (Dashboard)
function CommandCenterTab({ data }: any) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
       <div className="space-y-6">
          <section className="stat-card border-cyan-500/20 bg-cyan-500/[0.01]">
             <h3 className="text-xs font-black tracking-widest uppercase mb-6 flex items-center gap-2 text-cyan-400"><Cpu className="w-4 h-4" /> Altyapı Planı</h3>
             <div className="grid grid-cols-1 gap-3">
               <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                 <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Compute Environment</p>
                 <p className="text-xl font-black italic text-cyan-400">{data?.deployment?.service?.plan || 'Northflank Compute 20'}</p>
                 <div className="flex gap-3 mt-4 text-[10px] font-mono opacity-60 uppercase">
                    <span>Instances: {data?.deployment?.service?.instances}</span>
                    <span>Region: EU-WEST-1</span>
                 </div>
               </div>
               <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                 <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Database Resource</p>
                 <p className="text-xl font-black italic text-purple-400">PostgreSQL {data?.deployment?.addon?.dbVersion || '14.13'}</p>
                 <div className="flex gap-3 mt-4 text-[10px] font-mono opacity-60 uppercase">
                    <span>Storage: {data?.deployment?.addon?.storage || 4096}MB</span>
                    <span>Type: Primary Addon</span>
                 </div>
               </div>
             </div>
          </section>

          <section className="stat-card border-primary/20">
             <h3 className="text-xs font-black tracking-widest uppercase mb-6 flex items-center gap-2 text-primary"><Activity className="w-4 h-4" /> Worker Rhythms</h3>
             <div className="space-y-2">
                {data?.worker?.intervals.map((w: any) => (
                   <div key={w.name} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                      <span className="text-[10px] font-black">{w.name}</span>
                      <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{w.interval}</span>
                   </div>
                ))}
             </div>
          </section>
       </div>

       <div className="xl:col-span-2 space-y-6 flex flex-col items-stretch">
          <section className="stat-card border-white/10 bg-black/40 p-0 overflow-hidden flex-1 relative flex flex-col">
             <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Global Terminal Logs (Live)</span>
             </div>
             <div className="flex-1 p-4 font-mono text-[10px] overflow-y-auto custom-scrollbar space-y-1.5 h-[400px] select-text">
                {data?.logs.map((l: any, i: number) => (
                   <div key={i} className="flex gap-3 opacity-80 hover:opacity-100 transition-opacity">
                      <span className="text-muted-foreground shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                      <span className={`shrink-0 font-black ${l.type === 'error' ? 'text-red-500' : 'text-primary'}`}>{l.type?.toUpperCase()}</span>
                      <span className="text-white/80">{l.message}</span>
                   </div>
                ))}
             </div>
          </section>

          <div className="grid grid-cols-3 gap-6">
             <div className="stat-card border-white/5 bg-white/[0.01] text-center">
                <div className="text-3xl font-black italic text-primary">{data?.db?.userCount}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ACTIVE OPERATIVES</div>
             </div>
             <div className="stat-card border-white/5 bg-white/[0.01] text-center">
                <div className="text-3xl font-black italic text-blue-400">%{data?.performance?.winRate.toFixed(1)}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">MISSION SUCCESS RATE</div>
             </div>
             <div className="stat-card border-white/5 bg-white/[0.01] text-center">
                <div className="text-3xl font-black italic text-cyan-400">{data?.performance?.total}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">TOTAL ENGAGEMENTS</div>
             </div>
          </div>
       </div>
    </div>
  );
}

// 2. INTELLIGENCE (Users)
function IntelligenceTab({ users, onPurge, onAction, actionLoading }: any) {
  return (
    <div className="stat-card border-white/5 bg-black/20 p-6 rounded-3xl backdrop-blur-3xl">
       <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-3">
             <Users className="w-6 h-6 text-primary" /> FIELD OPERATIVES (USERS)
          </h3>
          <button className="btn-primary !px-4 !py-2 text-[10px] flex items-center gap-2">
             <UserPlus className="w-4 h-4" /> NEW OPERATIVE
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users?.map((u: any) => (
             <div key={u.id} className="stat-card border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all group overflow-hidden relative">
                {u.is_admin && <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-black text-[8px] font-black uppercase tracking-wider rounded-bl-xl shadow-lg shadow-primary/20">ADMIN</div>}
                
                <div className="flex items-start justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${u.is_admin ? 'bg-primary/20' : 'bg-white/5'}`}>
                         <ShieldCheck className={`w-5 h-5 ${u.is_admin ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                         <p className="font-black italic text-lg tracking-tight -mb-1">{u.username.toUpperCase()}</p>
                         <p className="text-[9px] font-mono text-muted-foreground">{u.email}</p>
                      </div>
                   </div>
                   <div className="text-[9px] font-black bg-white/5 px-2 py-1 rounded-md">ID: {u.id}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6 text-center">
                   <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                      <p className="text-[18px] font-black text-white">{u.order_count}</p>
                      <p className="text-[8px] font-black opacity-40 uppercase tracking-widest">Orders</p>
                   </div>
                   <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                      <p className="text-[18px] font-black text-white">{u.asset_count}</p>
                      <p className="text-[8px] font-black opacity-40 uppercase tracking-widest">Assets</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button 
                      onClick={() => onAction('toggle_admin', { userId: u.id, isAdmin: !u.is_admin })}
                      disabled={u.id === 1}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
                   >
                     {u.is_admin ? 'Demote' : 'Promote Admin'}
                   </button>
                   <button 
                      onClick={() => onPurge(u.id, u.username)}
                      disabled={u.id === 1}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
                   >
                      PURGE DATA
                   </button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

// 3. NEXUS (Database Explorer)
function NexusTab({ tables, selectedTable, data, loading, onTableSelect, onDeleteRow, actionLoading }: any) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
       {/* Sidebar: Table List */}
       <div className="stat-card border-white/10 bg-black/20 overflow-y-auto h-[600px] custom-scrollbar">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-6 flex items-center gap-2">
             <Layers className="w-4 h-4" /> Nexus Modules
          </h4>
          <div className="space-y-1">
             {tables?.map((table: any) => (
                <button 
                  key={`${table.table_schema}.${table.table_name}`}
                  onClick={() => onTableSelect(table.table_name, table.table_schema)}
                  className={`w-full p-4 rounded-2xl text-left text-xs font-black italic tracking-tight transition-all flex items-center justify-between group ${selectedTable?.name === table.table_name && selectedTable?.schema === table.table_schema ? 'bg-primary text-black shadow-xl shadow-primary/10' : 'hover:bg-white/5 text-white/50 hover:text-white border border-transparent'}`}
                >
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{table.table_schema}</span>
                      <span>{table.table_name.toUpperCase()}</span>
                   </div>
                   {selectedTable?.name === table.table_name && selectedTable?.schema === table.table_schema && <ChevronRight className="w-4 h-4" />}
                </button>
             ))}
          </div>
       </div>

       {/* Data Grid */}
       <div className="xl:col-span-3 stat-card border-white/5 bg-black/40 p-0 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                   <Database className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-black italic tracking-widest text-white uppercase">
                   {selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : 'SELECT MODULE'} RECORDS
                </h3>
             </div>
             <div className="text-[10px] font-mono opacity-50 uppercase">Showing last 50 entries</div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-6">
             {loading ? (
                <div className="h-full flex items-center justify-center text-primary font-black italic animate-pulse">SYNCHRONIZING NEXUS DATA...</div>
             ) : (
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="border-b border-white/10">
                         {data && data.length > 0 && Object.keys(data[0]).map(k => (
                            <th key={k} className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 first:rounded-l-xl last:rounded-r-xl">{k}</th>
                         ))}
                         <th className="p-3 bg-white/5 rounded-r-xl"></th>
                      </tr>
                   </thead>
                   <tbody>
                      {data?.map((row: any, i: number) => (
                         <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                            {Object.values(row).map((val: any, j: number) => (
                               <td key={j} className="p-3 text-[10px] font-mono text-white/70 max-w-[200px] truncate group-hover:text-white">
                                  {typeof val === 'object' ? JSON.stringify(val).substring(0, 30) + '...' : String(val)}
                               </td>
                            ))}
                            <td className="p-3 text-right">
                               <button 
                                 onClick={() => onDeleteRow(row.id)}
                                 className="p-2 text-red-500/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             )}
          </div>
       </div>
    </div>
  );
}

// 4. ACTION CENTER (Signal Station)
function AdvancedSignalStation({ users, onTrigger, loading }: any) {
  const [symbol, setSymbol ] = useState("BTCUSDT");
  const [targetId, setTargetId] = useState<string | number>("ALL");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
       <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Mission Operative (Target)</label>
          <select 
             className="input-field w-full text-sm font-mono bg-black"
             value={targetId}
             onChange={(e) => setTargetId(e.target.value)}
          >
             <option value="ALL">ALL OPERATIVES (Global Sweep)</option>
             {users?.map((u: any) => (
                <option key={u.id} value={u.id}>{u.username.toUpperCase()} (ID: {u.id})</option>
             ))}
          </select>
       </div>
       <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Target Asset (Symbol)</label>
          <input 
             className="input-field w-full text-sm font-mono uppercase"
             value={symbol}
             onChange={(e) => setSymbol(e.target.value)}
             placeholder="e.g. BTCUSDT"
          />
       </div>
       <div className="flex gap-2">
          <button 
            onClick={() => onTrigger(symbol, 'BUY', targetId === 'ALL' ? 'ALL' : Number(targetId))}
            disabled={loading}
            className="flex-1 btn-primary !h-[46px] !rounded-xl text-xs font-black italic flex items-center justify-center gap-2 group"
          >
             <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" /> {targetId === 'ALL' ? 'GLOBAL BUY' : 'INJECT BUY'}
          </button>
          <button 
            onClick={() => onTrigger(symbol, 'SELL', targetId === 'ALL' ? 'ALL' : Number(targetId))}
            disabled={loading}
            className="flex-1 !h-[46px] !rounded-xl text-xs font-black italic border-2 border-red-500 text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 group"
          >
             <ShieldAlert className="w-4 h-4 group-hover:rotate-12 transition-transform" /> {targetId === 'ALL' ? 'GLOBAL SELL' : 'INJECT SELL'}
          </button>
       </div>
    </div>
  );
}

// 5. ANNOUNCER (Notifications)
function AnnouncerTab({ users, onAction, actionLoading }: any) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("INFO");
  const [targetId, setTargetId] = useState("ALL");
  const [type, setType] = useState("BOTH");
  const [sending, setSending] = useState(false);
  const { notify } = useNotification();

  const handleSend = async () => {
    if (!title || !message) return notify("Başlık ve mesaj zorunludur", "warning");
    setSending(true);
    try {
      const res = await api.post("/notifications", {
        title,
        message,
        level,
        userId: targetId === "ALL" ? null : Number(targetId),
        type
      });
      if (res.data.success) {
        notify("Duyuru başarıyla gönderildi!", "success");
        setTitle("");
        setMessage("");
      }
    } catch (err) {
      notify("Duyuru gönderilemedi", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stat-card border-white/5 bg-black/20 p-8 rounded-3xl backdrop-blur-3xl max-w-4xl mx-auto">
       <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Send className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase">SİSTEM DUYURUSU OLUŞTUR</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.4em]">Broadcaster v1.0</p>
          </div>
       </div>

       <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">HEDEF KİTLE</label>
                <select 
                   value={targetId}
                   onChange={(e) => setTargetId(e.target.value)}
                   className="input-field w-full bg-black/40 text-sm font-mono border-white/10"
                >
                   <option value="ALL">TÜM OPERATÖRLER (Global)</option>
                   {users?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.username.toUpperCase()} (ID: {u.id})</option>
                   ))}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">ÖNCELİK SEVİYESİ</label>
                <div className="flex gap-2">
                   {['INFO', 'WARN', 'ALERT'].map(l => (
                      <button 
                        key={l}
                        onClick={() => setLevel(l)}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${level === l ? (l === 'INFO' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' : 'border-rose-500 bg-rose-500/20 text-rose-400') : 'border-white/5 bg-white/5 opacity-40 hover:opacity-100'}`}
                      >
                         {l}
                      </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-500 ml-2">DUYURU BAŞLIĞI</label>
             <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Sistem Bakımı Hakkında"
                className="input-field w-full bg-black/40 text-base font-bold border-white/10 focus:border-primary/50"
             />
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-slate-500 ml-2">MESAJ İÇERİĞİ</label>
             <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Kullanıcılara iletmek istediğiniz mesajı buraya yazın..."
                className="input-field w-full bg-black/40 text-sm font-medium border-white/10 focus:border-primary/50 resize-none py-4 leading-relaxed"
             />
          </div>

          <div className="flex items-center justify-between pt-4">
             <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                   <input type="radio" name="type" checked={type==='BOTH'} onChange={()=>setType('BOTH')} className="hidden" />
                   <div className={`w-3 h-3 rounded-full border-2 transition-all ${type==='BOTH' ? 'border-primary bg-primary' : 'border-slate-700'}`} />
                   <span className={`text-[10px] font-black uppercase tracking-widest ${type==='BOTH' ? 'text-white' : 'text-slate-500'}`}>Zil + Popup</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                   <input type="radio" name="type" checked={type==='HEADER'} onChange={()=>setType('HEADER')} className="hidden" />
                   <div className={`w-3 h-3 rounded-full border-2 transition-all ${type==='HEADER' ? 'border-primary bg-primary' : 'border-slate-700'}`} />
                   <span className={`text-[10px] font-black uppercase tracking-widest ${type==='HEADER' ? 'text-white' : 'text-slate-500'}`}>Sadece Zil</span>
                </label>
             </div>

             <button 
                onClick={handleSend}
                disabled={sending}
                className="btn-primary !h-14 !px-12 rounded-2xl flex items-center gap-3 group"
             >
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                <span className="text-sm font-black italic uppercase tracking-tighter">DUYURUYU YAYINLA</span>
             </button>
          </div>
       </div>
    </div>
  );
}

function CardAction({ label, desc, icon, onClick, loading, color = "border-primary/20 text-white" }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className={`stat-card text-left hover:scale-[1.02] active:scale-[0.98] transition-all group flex gap-4 items-center ${color}`}
    >
       <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors">
          {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : icon}
       </div>
       <div>
          <h4 className="font-black italic text-lg tracking-tight uppercase -mb-1">{label}</h4>
          <p className="text-[10px] text-muted-foreground italic font-medium">{desc}</p>
       </div>
    </button>
  );
}

// 6. TOOLBOX (CLI Web GUI)
function ToolboxTab({ users }: any) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string>("ALL");
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const tools = [
    { id: "master_trade_audit", name: "Trade Audit", icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, desc: "İşlem ve winrate analiz" },
    { id: "master_pilot_hub", name: "Pilot Hub", icon: <Activity className="w-4 h-4 text-cyan-400" />, desc: "Sinyal ve bot izleme" },
    { id: "master_portfolio_guardian", name: "Portfolio Guardian", icon: <ShieldAlert className="w-4 h-4 text-amber-400" />, desc: "Hesap kural denetimi" },
    { id: "master_performance_analyzer", name: "Performance", icon: <Activity className="w-4 h-4 text-blue-400" />, desc: "Ticaret performansı" },
    { id: "master_system_audit", name: "System Audit", icon: <Cpu className="w-4 h-4 text-purple-400" />, desc: "Altyapı sağlığı" },
    { id: "master_db_orchestrator", name: "DB Orchestrator", icon: <Database className="w-4 h-4 text-rose-400" />, desc: "Veritabanı yönetimi" },
    { id: "master_db_scan", name: "DB Scan", icon: <Search className="w-4 h-4 text-rose-300" />, desc: "Tablo taraması" },
    { id: "master_maintenance_kit", name: "Maintenance Kit", icon: <Settings2 className="w-4 h-4 text-slate-400" />, desc: "Bakım onarım" },
    { id: "master_test_lab", name: "Test Lab", icon: <Zap className="w-4 h-4 text-yellow-400" />, desc: "Simülasyon testleri" },
    { id: "master_deployment_hub", name: "Deployment", icon: <Globe className="w-4 h-4 text-indigo-400" />, desc: "Bulut dağıtım denetimi" }
  ];

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRunTool = async (toolId: string) => {
    setLoading(true);
    setActiveTool(toolId);
    setLogs(`\n> [${new Date().toLocaleTimeString('tr-TR')}] INITIATING TOOL: ${toolId}...\n> Lütfen bekleyin, bu işlem 5-15 saniye sürebilir...\n----------------------------------------------------\n`);
    try {
      const res = await fetch("/api/admin/toolbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, userId: targetUserId !== "ALL" ? targetUserId : undefined })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => prev + data.logs + `\n\n> [${new Date().toLocaleTimeString('tr-TR')}] PROCESS TERMINATED.`);
      } else {
        setLogs(prev => prev + "\n[ CRITICAL ERROR ]: " + data.error);
      }
    } catch (err: any) {
      setLogs(prev => prev + "\n[ NETWORK FAILURE ]: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
       <div className="stat-card border-white/10 bg-black/20 overflow-y-auto h-[600px] custom-scrollbar">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-6 flex items-center gap-2">
             <Terminal className="w-4 h-4" /> MASTER TOOLS
          </h4>
          <div className="mb-4">
             <label className="text-[9px] font-black uppercase text-slate-500 mb-2 block ml-1">HEDEF OPERATÖR (KULLANICI)</label>
             <select 
               value={targetUserId}
               onChange={(e) => setTargetUserId(e.target.value)}
               className="input-field w-full bg-black/40 text-xs font-mono border-white/10"
             >
                <option value="ALL">SİSTEM GENELİ (VARSAYILAN)</option>
                {users?.map((u: any) => (
                   <option key={u.id} value={u.id}>{u.username.toUpperCase()} (ID: {u.id})</option>
                ))}
             </select>
          </div>
          <div className="space-y-2">
             {tools.map((t) => (
                <button 
                  key={t.id}
                  onClick={() => handleRunTool(t.id)}
                  disabled={loading}
                  className={`w-full p-4 rounded-2xl text-left transition-all group border ${activeTool === t.id ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:border-white/20'}`}
                >
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-black/50 rounded-lg">{t.icon}</div>
                      <div>
                         <p className={`text-xs font-black uppercase tracking-widest ${activeTool === t.id ? 'text-cyan-400' : ''}`}>{t.name}</p>
                         <p className="text-[9px] text-muted-foreground font-mono truncate">{t.desc}</p>
                      </div>
                   </div>
                </button>
             ))}
          </div>
       </div>

       <div className="xl:col-span-3 stat-card border-cyan-500/20 bg-black/90 p-0 flex flex-col h-[600px] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          
          <div className="p-4 border-b border-cyan-500/10 bg-cyan-950/20 flex items-center justify-between backdrop-blur-md">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                   {loading ? <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" /> : <Terminal className="w-4 h-4 text-cyan-400" />}
                </div>
                <h3 className="text-sm font-black italic tracking-widest text-cyan-400 uppercase">
                   CYBERPUNK TERMINAL {activeTool ? `[ ${activeTool} ]` : ''}
                </h3>
             </div>
             <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/30"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/30"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/30"></div>
             </div>
          </div>

          <div className="flex-1 p-6 font-mono text-xs sm:text-sm text-cyan-400/90 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 selection:text-white select-text">
             {logs || "> SİSTEM HAZIR. SOL PANELDEKİ ARAÇLARDAN BİRİNİ SEÇİN...\n> BAĞLANTI GÜVENLİ."}
             {loading && <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1 align-middle"></span>}
             <div ref={logEndRef} />
          </div>
       </div>
    </div>
  );
}
