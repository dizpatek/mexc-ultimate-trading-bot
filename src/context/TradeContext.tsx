"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { SmartTradeOrder } from "@/components/ActiveSmartTrades";

interface TradeContextType {
  symbol: string;
  setSymbol: (s: string) => void;
  buyPrice: string;
  setBuyPrice: (p: string) => void;
  tpPrice: string;
  setTpPrice: (p: string) => void;
  slPrice: string;
  setSlPrice: (p: string) => void;
  tpEnabled: boolean;
  setTpEnabled: (e: boolean) => void;
  slEnabled: boolean;
  setSlEnabled: (e: boolean) => void;
  mode: "TRADE" | "COVER";
  setMode: (m: "TRADE" | "COVER") => void;
  editingTrade: SmartTradeOrder | null;
  setEditingTrade: (trade: SmartTradeOrder | null) => void;
  amount: string;
  setAmount: (amt: string) => void;
  allocationPercent: number;
  setAllocationPercent: (pct: number) => void;
  useExisting: boolean;
  setUseExisting: (use: boolean) => void;
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;
  isTradeFormOpen: boolean;
  setIsTradeFormOpen: (open: boolean) => void;
  /** Ref to be attached to the SmartTrade 'Units' section for specific scrolling */
  unitsAnchorRef: React.MutableRefObject<HTMLElement | null>;
  /** Ref to be attached to the SmartTrade panel element for scrolling */
  tradeAnchorRef: React.MutableRefObject<HTMLElement | null>;
  /** Scroll to the trade panel. Sets pendingScroll if element is not yet mounted. */
  scrollToTrade: (targetSelection?: "TOP" | "UNITS") => void;
  /** True when a scroll was requested but the panel element was not found yet */
  pendingScroll: boolean | "UNITS";
  /** Call from inside the trade panel after it mounts to consume the pending scroll */
  consumePendingScroll: () => void;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider = ({ children }: { children: ReactNode }) => {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [buyPrice, setBuyPrice] = useState("0");
  const [tpPrice, setTpPrice] = useState("0");
  const [slPrice, setSlPrice] = useState("0");
  const [tpEnabled, setTpEnabled] = useState(true);
  const [slEnabled, setSlEnabled] = useState(true);
  const [mode, setMode] = useState<"TRADE" | "COVER">("TRADE");
  const [editingTrade, setEditingTrade] = useState<SmartTradeOrder | null>(
    null,
  );
  const [amount, setAmount] = useState("0");
  const [allocationPercent, setAllocationPercent] = useState(0);
  const [useExisting, setUseExisting] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [pendingScroll, setPendingScroll] = useState<boolean | "UNITS">(false);
  const tradeAnchorRef = useRef<HTMLElement | null>(null);
  const unitsAnchorRef = useRef<HTMLElement | null>(null);

  const scrollToTrade = useCallback(
    (targetSelection: "TOP" | "UNITS" = "TOP") => {
      const el =
        targetSelection === "UNITS"
          ? unitsAnchorRef.current
          : tradeAnchorRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Ref not attached yet — set flag for panel to consume on mount
        setPendingScroll(targetSelection === "UNITS" ? "UNITS" : true);
      }
    },
    [],
  );

  const consumePendingScroll = useCallback(() => {
    if (pendingScroll) {
      const target = pendingScroll;
      setPendingScroll(false);
      // Small defer to let sidebar transition actually start/mount
      setTimeout(() => {
        const el =
          target === "UNITS" ? unitsAnchorRef.current : tradeAnchorRef.current;
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [pendingScroll]);

  // Atomic reset of all trade parameters when the symbol changes or edit mode closes
  useEffect(() => {
    if (!editingTrade) {
      setBuyPrice("0");
      setTpPrice("0");
      setSlPrice("0");
      setTpEnabled(false);
      setSlEnabled(false);
      setAmount("0");
      setAllocationPercent(0);
      setMode("TRADE");
    }
  }, [symbol, editingTrade]);

  return (
    <TradeContext.Provider
      value={{
        symbol,
        setSymbol,
        buyPrice,
        setBuyPrice,
        tpPrice,
        setTpPrice,
        slPrice,
        setSlPrice,
        tpEnabled,
        setTpEnabled,
        slEnabled,
        setSlEnabled,
        mode,
        setMode,
        editingTrade,
        setEditingTrade,
        amount,
        setAmount,
        allocationPercent,
        setAllocationPercent,
        useExisting,
        setUseExisting,
        isPanelOpen,
        setIsPanelOpen,
        isTradeFormOpen,
        setIsTradeFormOpen,
        tradeAnchorRef,
        unitsAnchorRef,
        scrollToTrade,
        pendingScroll,
        consumePendingScroll,
      }}
    >
      {children}
    </TradeContext.Provider>
  );
};

export const useTrade = () => {
  const context = useContext(TradeContext);
  if (!context) throw new Error("useTrade must be used within a TradeProvider");
  return context;
};
