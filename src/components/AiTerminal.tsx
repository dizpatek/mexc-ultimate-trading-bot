"use client";

import { useState, useRef, useEffect } from "react";
import { Terminal, Send, Cpu, Power, Loader2 } from "lucide-react";

export function AiTerminal() {
  const [messages, setMessages] = useState<{ role: "system" | "user" | "ai", content: string }[]>([
    { role: "system", content: "INITIALIZING MEXCBRAIN KERNEL v2.0..." },
    { role: "system", content: "INFERENCE ENGINE: ONLINE" },
    { role: "system", content: "WAITING FOR USER QUERY..." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userPrompt = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: `> ${userPrompt}` }]);
    setLoading(true);

    try {
      const res = await fetch("/api/autoresearch/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: userPrompt })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Internal Error");
      }

      setMessages(prev => [...prev, { role: "ai", content: data.response }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setMessages(prev => [...prev, { role: "system", content: `[ERROR]: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#050505] border border-emerald-500/20 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)] relative group">
      
      {/* Background Matrix Effect Elements */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://transparenttextures.com/patterns/cubes.png')] mix-blend-screen pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-black/40 border-b border-emerald-500/20 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Cpu className="w-6 h-6 text-emerald-400" />
            <div className="absolute inset-0 bg-emerald-400 blur-md opacity-40 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-emerald-400 text-sm font-black uppercase tracking-[0.3em]">AI_CORE_TERMINAL</h3>
            <span className="text-[9px] font-mono text-emerald-400/50 uppercase tracking-widest">NanoGPT Inference Engine</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">GPU ONLINE</span>
          </div>
          <Power className="w-4 h-4 text-emerald-400/50 hover:text-emerald-400 cursor-pointer transition-colors" />
        </div>
      </div>

      {/* Terminal Screen */}
      <div 
        ref={scrollRef}
        className="flex-1 p-8 overflow-y-auto cyber-scrollbar font-mono text-[13px] leading-relaxed relative z-10"
      >
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${
                msg.role === "system" ? "text-emerald-500/50" : 
                msg.role === "user" ? "text-white/80" : "text-emerald-400"
              }`}
            >
               <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          ))}
          
          {loading && (
            <div className="flex items-center gap-3 text-emerald-400/70 mt-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="animate-pulse">GENERATING RESPONSE...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input UI */}
      <div className="p-6 bg-black/60 border-t border-emerald-500/20 backdrop-blur-xl relative z-10">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-6 text-emerald-500 font-black">&gt;</div>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="w-full bg-black/50 border border-emerald-500/30 rounded-2xl py-5 pl-12 pr-16 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
            placeholder="Query MexCBrain AI..."
            autoFocus
          />
          <button 
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-4 p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50 disabled:hover:bg-emerald-500/20 disabled:hover:text-emerald-400"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

    </div>
  );
}
