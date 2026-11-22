"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Staggered fade-up of every [data-reveal] child whenever `deps` change. */
export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useIso(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const items = ref.current!.querySelectorAll("[data-reveal]");
      if (items.length)
        gsap.fromTo(
          items,
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.06, clearProps: "transform" }
        );
      const lines = ref.current!.querySelectorAll(".wf-reveal-mask > span");
      if (lines.length)
        gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function CountUp({ value, decimals = 0, duration = 1.2 }: { value: number | null | undefined; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    if (!ref.current || value === null || value === undefined || Number.isNaN(value)) return;
    const obj = { v: prev.current };
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        if (ref.current)
          ref.current.textContent = obj.v.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
      },
    });
    prev.current = value;
    return () => {
      tween.kill();
    };
  }, [value, decimals, duration]);
  if (value === null || value === undefined || Number.isNaN(value)) return <span>—</span>;
  return <span ref={ref}>0</span>;
}

export function Skeleton({ h = 16, w = "100%", r = 12, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="wf-skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function KpiSkeletons({ n = 4 }: { n?: number }) {
  return (
    <div className={`wf-grid k${n}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="wf-kpi">
          <Skeleton h={10} w={90} />
          <Skeleton h={38} w="70%" style={{ marginTop: 16 }} />
          <Skeleton h={10} w="50%" style={{ marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ h = 320 }: { h?: number }) {
  return (
    <div className="wf-card">
      <Skeleton h={12} w={160} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: h - 60, marginTop: 24 }}>
        {Array.from({ length: 36 }).map((_, i) => (
          <div
            key={i}
            className="wf-skel"
            style={{ flex: 1, height: `${30 + 50 * Math.abs(Math.sin(i * 0.45))}%`, borderRadius: 4 }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="wf-card" style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={14} w={`${90 - (i % 3) * 12}%`} />
      ))}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  decimals = 0,
  foot,
  color,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  foot?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="wf-kpi" data-reveal style={color ? ({ "--kc": color } as React.CSSProperties) : undefined}>
      <div className="label" style={color ? { color } : undefined}>
        {label}
      </div>
      <div className="wf-kpi-value">
        <CountUp value={value} decimals={decimals} />
        {unit && <span className="wf-kpi-unit">{unit}</span>}
      </div>
      {foot && <div className="wf-kpi-foot">{foot}</div>}
    </div>
  );
}

export function SectionHead({
  index,
  title,
  ghost,
  lead,
  actions,
}: {
  index: string;
  title: string;
  ghost?: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="wf-section-head">
      <div>
        <div className="label wf-index" data-reveal>
          {index.replace(/^\d+\s*—\s*/, (m) => m)}
        </div>
        <h1 className="wf-h1" style={{ marginTop: 14 }}>
          <span className="wf-reveal-mask">
            <span>{title}</span>
          </span>
          {ghost && (
            <span className="wf-reveal-mask">
              <span>
                <em>{ghost}</em>
              </span>
            </span>
          )}
        </h1>
        {lead && (
          <p className="wf-lead" data-reveal>
            {lead}
          </p>
        )}
      </div>
      {actions && (
        <div className="wf-row" data-reveal>
          {actions}
        </div>
      )}
    </div>
  );
}

export function StageBar({ running, label }: { running: boolean; label: string }) {
  if (!running) return null;
  return (
    <div className="wf-card" style={{ marginBottom: 24 }}>
      <div className="wf-between" style={{ marginBottom: 12 }}>
        <span className="label">{label}</span>
        <span className="wf-dot live" />
      </div>
      <div className="wf-progress">
        <div />
      </div>
    </div>
  );
}

export function ChartTip({ active, payload, label, labelFmt, units }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="wf-tip">
      <div className="label">{labelFmt ? labelFmt(label) : label}</div>
      {payload
        .filter((p: any) => p.value !== null && p.value !== undefined && p.name)
        .map((p: any) => (
          <div key={p.dataKey + p.name} style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
            <span style={{ color: p.stroke && p.stroke !== "none" ? p.stroke : p.color || p.fill }}>{p.name}</span>
            <span className="mono">
              {typeof p.value === "number" ? p.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(p.value)}
              {units?.[p.dataKey] ? ` ${units[p.dataKey]}` : ""}
            </span>
          </div>
        ))}
    </div>
  );
}
