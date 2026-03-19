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
  
  // New States for Chart/Form Sync
  trailingBuy: boolean;
  setTrailingBuy: (v: boolean) => void;
  trailingBuyDev: number;
  setTrailingBuyDev: (v: number) => void;
  trailingTp: boolean;
  setTrailingTp: (v: boolean) => void;
  tpDeviation: number;
  setTpDeviation: (v: number) => void;
  isSplitTp: boolean;
  setIsSplitTp: (v: boolean) => void;
  tpTargets: { id: string; price: string; volume: number }[];
  setTpTargets: React.Dispatch<React.SetStateAction<{ id: string; price: string; volume: number }[]>>;
  trailingSl: boolean;
  setTrailingSl: (v: boolean) => void;
  moveToBreakeven: boolean;
  setMoveToBreakeven: (v: boolean) => void;
  slTimeout: boolean;
  setSlTimeout: (v: boolean) => void;
  showChart: boolean;
  setShowChart: (v: boolean) => void;
  priceSync: boolean;
  setPriceSync: (v: boolean) => void;
  marketPrice: number | null;
  setMarketPrice: (v: number | null) => void;

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

  // New states
  const [trailingBuy, setTrailingBuy] = useState(false);
  const [trailingBuyDev, setTrailingBuyDev] = useState(0.1);
  const [trailingTp, setTrailingTp] = useState(false);
  const [tpDeviation, setTpDeviation] = useState(-1.0);
  const [isSplitTp, setIsSplitTp] = useState(false);
  const [tpTargets, setTpTargets] = useState<{ id: string; price: string; volume: number }[]>([
    { id: "1", price: "0", volume: 100 }
  ]);
  const [trailingSl, setTrailingSl] = useState(false);
  const [moveToBreakeven, setMoveToBreakeven] = useState(false);
  const [slTimeout, setSlTimeout] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [priceSync, setPriceSync] = useState(true);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);

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
      setTpEnabled(true);
      setSlEnabled(true);
      setAmount("0");
      setAllocationPercent(0);
      setMode("TRADE");
      setTrailingBuy(false);
      setTrailingTp(false);
      setTrailingSl(false);
      setIsSplitTp(false);
      setTpTargets([{ id: "1", price: "0", volume: 100 }]);
      setPriceSync(true);
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
        trailingBuy,
        setTrailingBuy,
        trailingBuyDev,
        setTrailingBuyDev,
        trailingTp,
        setTrailingTp,
        tpDeviation,
        setTpDeviation,
        isSplitTp,
        setIsSplitTp,
        tpTargets,
        setTpTargets,
        trailingSl,
        setTrailingSl,
        moveToBreakeven,
        setMoveToBreakeven,
        slTimeout,
        setSlTimeout,
        showChart,
        setShowChart,
        priceSync,
        setPriceSync,
        marketPrice,
        setMarketPrice,
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
