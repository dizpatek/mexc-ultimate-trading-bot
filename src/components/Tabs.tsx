"use client";

import React, { createContext, useContext, useState } from 'react';

// Context to share active tab state
const TabsContext = createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
} | null>(null);

export function Tabs({ 
  children, 
  defaultValue, 
  className = "" 
}: { 
  children: React.ReactNode; 
  defaultValue: string;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center border-b border-white/10 bg-white/5 rounded-t-lg ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ 
  value, 
  children,
  className = ""
}: { 
  value: string; 
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.activeTab === value;

  return (
    <button
      onClick={() => context.setActiveTab(value)}
      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 
        ${isActive 
          ? 'border-primary text-primary bg-primary/5' 
          : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'} 
        ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ 
  value, 
  children,
  className = ""
}: { 
  value: string; 
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.activeTab !== value) return null;

  return (
    <div className={`animate-in fade-in zoom-in-95 duration-200 ${className}`}>
      {children}
    </div>
  );
}
