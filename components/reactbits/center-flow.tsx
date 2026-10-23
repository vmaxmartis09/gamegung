"use client";

import React, { useId } from "react";
import { motion } from "framer-motion";

export interface CenterFlowNode {
  id: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  angle?: number;
  isAlive?: boolean;
  color?: string;
  content: React.ReactNode;
}

interface CenterFlowProps {
  centerNode: React.ReactNode;
  nodes: CenterFlowNode[];
  isNight?: boolean;
  className?: string;
}

export function CenterFlow({
  centerNode,
  nodes,
  isNight = false,
  className = "",
}: CenterFlowProps) {
  const flowId = useId();

  // Primary colors
  const primaryColor = isNight ? "#a855f7" : "#f59e0b";
  const glowColor = isNight ? "rgba(168, 85, 247, 0.4)" : "rgba(245, 158, 11, 0.45)";

  return (
    <div
      className={`relative w-full aspect-[4/3] max-w-[880px] min-h-[520px] sm:min-h-[600px] mx-auto select-none overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-b from-[#0a0712] via-[#050309] to-[#020104] shadow-2xl p-4 ${className}`}
    >
      {/* Background radial ambiance */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000"
        style={{
          background: isNight
            ? "radial-gradient(circle at 50% 50%, rgba(88, 28, 135, 0.22) 0%, rgba(2, 1, 6, 0.95) 75%)"
            : "radial-gradient(circle at 50% 50%, rgba(217, 119, 6, 0.18) 0%, rgba(2, 1, 6, 0.95) 75%)",
        }}
      />

      {/* Center Flow SVG: Flow paths from hub to all nodes */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient
            id={`center-flow-grad-${flowId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.85" />
            <stop offset="60%" stopColor={primaryColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
          </linearGradient>

          <filter id={`glow-${flowId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {nodes.map((node, i) => {
          // Curved path from (50, 50) to (node.x, node.y)
          // We can introduce a gentle curve through a control point
          const midX = (50 + node.x) / 2;
          const midY = (50 + node.y) / 2;
          // slight curvature perpendicular to the vector
          const dx = node.x - 50;
          const dy = node.y - 50;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const curvature = (i % 2 === 0 ? 1 : -1) * 3;
          const ctrlX = dist > 0 ? midX - (dy / dist) * curvature : midX;
          const ctrlY = dist > 0 ? midY + (dx / dist) * curvature : midY;

          const pathD = `M 50 50 Q ${ctrlX} ${ctrlY} ${node.x} ${node.y}`;
          const isAlive = node.isAlive !== false;

          return (
            <g key={`flow-${node.id}`}>
              {/* Static flow line */}
              <path
                d={pathD}
                fill="none"
                stroke={node.color || `url(#center-flow-grad-${flowId})`}
                strokeWidth={isAlive ? "1.8" : "1"}
                strokeDasharray={isAlive ? "4 4" : "2 6"}
                strokeOpacity={isAlive ? (isNight ? 0.45 : 0.4) : 0.15}
              />

              {/* Animated energy pulse traveling along the line if node is alive */}
              {isAlive && (
                <circle r="3" fill={primaryColor} filter={`url(#glow-${flowId})`}>
                  <animateMotion
                    path={pathD}
                    dur={`${2.4 + (i % 3) * 0.5}s`}
                    repeatCount="indefinite"
                    begin={`${(i * 0.3) % 2}s`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0.2;1;0.2"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Central Hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center">
        {centerNode}
      </div>

      {/* Outer Nodes (Players / Seats) */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
        >
          {node.content}
        </div>
      ))}
    </div>
  );
}
