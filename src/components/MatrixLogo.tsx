import React from "react";
import { cn } from "@/lib/utils";

interface MatrixLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const MatrixLogo: React.FC<MatrixLogoProps> = ({
  className,
  size = 32,
  glow = true,
}) => {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
      )}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
      >
        {/* Outer Hexagon Frame */}
        <path
          d="M 50 5 L 90 27 L 90 73 L 50 95 L 10 73 L 10 27 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-cyan-500/30"
        />

        {/* Animated Inner Hexagon */}
        <path
          d="M 50 12 L 83 31 L 83 69 L 50 88 L 17 69 L 17 31 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-cyan-400 animate-matrix-dash"
        />

        {/* Stylized 'M' inside */}
        <path
          d="M 30 70 V 35 L 50 55 L 70 35 V 70"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-400"
        />

        {/* F4 Indicator - Small Dot/Line */}
        <circle
          cx="50"
          cy="75"
          r="4"
          className="fill-indigo-500 animate-pulse"
        />

        {/* Scanning Line */}
        <line
          x1="15"
          y1="20"
          x2="85"
          y2="20"
          stroke="white"
          strokeWidth="1"
          className="opacity-40 animate-matrix-scan"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 -10"
            to="0 90"
            dur="3s"
            repeatCount="indefinite"
          />
        </line>

        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
};
