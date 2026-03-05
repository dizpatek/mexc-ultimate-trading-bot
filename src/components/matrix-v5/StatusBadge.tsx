import React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "aqua";

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}

// Matrix V3 Color Palette
const COLORS = {
  success: "#089981", // Green
  danger: "#F23645", // Red
  warning: "#ff9800", // Orange
  info: "#2157F4", // Blue
  aqua: "#00bcd4", // Aqua/Cyan
  neutral: "#878b94", // Gray
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = "neutral",
  pulse = false,
  className,
}) => {
  const getColor = (v: BadgeVariant) => COLORS[v];

  // Dynamic styles based on variant
  const style = {
    color: getColor(variant),
    borderColor: `${getColor(variant)}33`, // 20% opacity for border
    backgroundColor: `${getColor(variant)}11`, // ~7% opacity for bg
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border shadow-sm relative overflow-hidden transition-all",
        className,
      )}
      style={style}
    >
      {pulse && (
        <span className="absolute inset-0 animate-pulse opacity-20 bg-current"></span>
      )}
      <span className="relative z-10">{label}</span>

      {/* Optional: Glow effect for specific high-value badges */}
      {(variant === "success" ||
        variant === "danger" ||
        variant === "aqua") && (
        <div className="absolute inset-0 blur-md opacity-20 bg-current pointer-events-none" />
      )}
    </div>
  );
};
