"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { engineGet, fmtDate } from "./api";
import { usePrefs } from "./prefs";

/* Turbo colormap (Google, polynomial fit) — blue → cyan → green → yellow → red. */
function turbo(x: number): [number, number, number] {
  x = Math.min(1, Math.max(0, x));
  const r = 0.13572138 + x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
  const g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
  const b = 0.1066733 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
  const c = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v)));
  return [c(r), c(g), c(b)];
}
const TURBO_CSS = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => `rgb(${turbo(i / 10).join(",")}) ${i * 10}%`).join(", ")})`;

type L3 = { az: string; en: string; ru: string };
interface Metric {
  key: string;
  label: L3;
  unit: string;
  scale?: number;
  fixed?: [number, number];
}

const RATE_METRICS: Metric[] = [
  { key: "oil_rate_stbd", label: { az: "Neft", en: "Oil", ru: "Нефть" }, unit: "STB/d" },
  { key: "water_rate_stbd", label: { az: "Su", en: "Water", ru: "Вода" }, unit: "STB/d" },
  { key: "gas_rate_mscfd", label: { az: "Qaz", en: "Gas", ru: "Газ" }, unit: "Mscf/d" },
  { key: "water_cut_frac", label: { az: "Su payı", en: "Water cut", ru: "Обводн." }, unit: "%", scale: 100, fixed: [0, 100] },
];
const SENSOR_METRICS: Metric[] = [
  { key: "dh_pressure_psia", label: { az: "Quyudibi təzyiq", en: "Downhole P", ru: "Забойное P" }, unit: "psia" },
  { key: "whp_psia", label: { az: "Quyuağzı təzyiq", en: "Wellhead P", ru: "Устьевое P" }, unit: "psia" },
  { key: "dh_temperature_degf", label: { az: "Temperatur", en: "Temperature", ru: "Темп." }, unit: "°F" },
  { key: "gas_lift_rate_mscfd", label: { az: "Qaz-lift", en: "Gas lift", ru: "Газлифт" }, unit: "Mscf/d" },
];

const cache = new Map<string, Promise<any>>();
const get = (url: string, ver: string) => {
  const k = `${url}|${ver}`;
  if (!cache.has(k)) cache.set(k, engineGet(url).catch((e) => (cache.delete(k), Promise.reject(e))));
  return cache.get(k)!;
};

interface Grid {
  wells: string[];
  dates: string[];
  values: Record<string, (number | null)[][]>; // metric → [well][day]
}

function useGrid(kind: "rates" | "sensors", wells: string[], ver: string, enabled: boolean) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!enabled || !wells.length) return;
    let live = true;
    setGrid(null);
    setErr(false);
    const metrics = kind === "rates" ? RATE_METRICS : SENSOR_METRICS;
    Promise.allSettled(wells.map((w) => get(kind === "rates" ? `/api/wells/${w}/rates` : `/api/wells/${w}/sensors?resolution=1D`, ver)))
      .then((res) => {
        if (!live) return;
        const per = res.map((r) => {
          if (r.status !== "fulfilled") return new Map<string, any>();
          const d = r.value;
          const m = new Map<string, any>();
          if (kind === "rates") d.rows.forEach((row: any) => m.set(String(row.date).slice(0, 10), row));
          else d.series.t.forEach((t: string, i: number) => m.set(String(t).slice(0, 10), Object.fromEntries(metrics.map((x) => [x.key, d.series[x.key]?.[i]]))));
          return m;
        });
        const dates = Array.from(new Set(per.flatMap((m) => Array.from(m.keys())))).sort();
        if (!dates.length) return setErr(true);
        const values: Grid["values"] = {};
        metrics.forEach((x) => {
          values[x.key] = per.map((m) =>
            dates.map((d) => {
              const v = m.get(d)?.[x.key];
              return typeof v === "number" && Number.isFinite(v) ? v * (x.scale ?? 1) : null;
            })
          );
        });
        setGrid({ wells, dates, values });
      })
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [kind, wells.join(","), ver, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return { grid, err };
}

function range(rows: (number | null)[][], fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  const v = rows.flat().filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return [0, 1];
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  const lo = q(0.02);
  const hi = q(0.98);
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}

const LABEL_W = 54;
const ROW_H = 22;

function HeatCanvas({ grid, metric, selected, onSelect }: { grid: Grid; metric: Metric; selected?: string; onSelect?: (w: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(600);
  const [tip, setTip] = useState<{ x: number; y: number; well: string; date: string; v: number | null } | null>(null);
  const rows = grid.values[metric.key];
  const [lo, hi] = useMemo(() => range(rows, metric.fixed), [rows, metric.fixed]);
  const H = grid.wells.length * ROW_H;

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const plotW = w - LABEL_W;
    c.width = w * dpr;
    c.height = H * dpr;
    c.style.width = `${w}px`;
    c.style.height = `${H}px`;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, H);

    // 1 px per cell → stretched horizontally with smoothing (continuous in time, discrete across wells)
    const nC = grid.dates.length;
    const nR = grid.wells.length;
    const src = document.createElement("canvas");
    src.width = nC;
    src.height = nR;
    const sg = src.getContext("2d")!;
    const img = sg.createImageData(nC, nR);
    for (let r = 0; r < nR; r++)
      for (let k = 0; k < nC; k++) {
        const v = rows[r][k];
        const o = (r * nC + k) * 4;
        if (v === null) {
          img.data.set([22, 28, 38, 255], o);
        } else {
          const [R, G, B] = turbo((v - lo) / (hi - lo));
          img.data.set([R, G, B, 255], o);
        }
      }
    sg.putImageData(img, 0, 0);
    const mid = document.createElement("canvas");
    mid.width = Math.max(1, Math.round(plotW * dpr));
    mid.height = nR;
    const mg = mid.getContext("2d")!;
    mg.imageSmoothingEnabled = true;
    mg.imageSmoothingQuality = "high";
    mg.drawImage(src, 0, 0, mid.width, nR);
    g.imageSmoothingEnabled = false;
    for (let r = 0; r < nR; r++) g.drawImage(mid, 0, r, mid.width, 1, LABEL_W, r * ROW_H + 1, plotW, ROW_H - 2);

    // well labels
    const css = getComputedStyle(c);
    const ink2 = css.getPropertyValue("--ink-2").trim() || "#9aa6b6";
    const acc = css.getPropertyValue("--accent").trim() || "#ffb23e";
    g.font = '500 10.5px "JetBrains Mono", ui-monospace, monospace';
    g.textBaseline = "middle";
    grid.wells.forEach((name, r) => {
      const on = name === selected;
      g.fillStyle = on ? acc : ink2;
      g.fillText(name, 0, r * ROW_H + ROW_H / 2);
      if (on) {
        g.strokeStyle = acc;
        g.lineWidth = 1.5;
        g.strokeRect(LABEL_W + 0.75, r * ROW_H + 0.75, plotW - 1.5, ROW_H - 1.5);
      }
    });
  }, [grid, rows, lo, hi, w, H, selected]);

  const hit = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const r = Math.floor(y / ROW_H);
    const k = Math.floor(((x - LABEL_W) / (w - LABEL_W)) * grid.dates.length);
    if (x < LABEL_W || r < 0 || r >= grid.wells.length || k < 0 || k >= grid.dates.length) return null;
    return { x, y, r, k };
  };

  const ticks = useMemo(() => {
    const n = grid.dates.length;
    const step = Math.max(1, Math.ceil(n / 6));
    return grid.dates.map((d, i) => ({ d, i })).filter(({ i }) => i % step === 0);
  }, [grid.dates]);

  return (
    <div>
      <div
        ref={wrap}
        style={{ position: "relative", cursor: onSelect ? "pointer" : "crosshair" }}
        onMouseMove={(e) => {
          const h = hit(e);
          setTip(h ? { x: h.x, y: h.y, well: grid.wells[h.r], date: grid.dates[h.k], v: rows[h.r][h.k] } : null);
        }}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => {
          const h = hit(e);
          if (h && onSelect) onSelect(grid.wells[h.r]);
        }}
      >
        <canvas ref={cv} style={{ display: "block" }} />
        {tip && (
          <div className="wf-tip" style={{ position: "absolute", left: Math.min(tip.x + 14, w - 170), top: tip.y + 14, pointerEvents: "none", zIndex: 3, minWidth: 150 }}>
            <div className="label">{fmtDate(tip.date)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{tip.well}</span>
              <span className="mono">
                {tip.v === null ? "—" : tip.v.toLocaleString("en-US", { maximumFractionDigits: metric.unit === "%" ? 1 : 0 })} {metric.unit}
              </span>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: "relative", height: 18, marginLeft: LABEL_W, marginTop: 6 }}>
        {ticks.map(({ d, i }) => (
          <span key={d} className="mono dim" style={{ position: "absolute", left: `${(i / grid.dates.length) * 100}%`, fontSize: 10, whiteSpace: "nowrap" }}>
            {d.slice(5)}
          </span>
        ))}
      </div>
      <div className="wf-row" style={{ marginLeft: LABEL_W, marginTop: 8, gap: 10, flexWrap: "nowrap" }}>
        <span className="mono dim" style={{ fontSize: 10.5 }}>
          {lo.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
        <div className="wf-heat-scale" style={{ background: TURBO_CSS }} />
        <span className="mono dim" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>
          {hi.toLocaleString("en-US", { maximumFractionDigits: 0 })} {metric.unit}
        </span>
      </div>
    </div>
  );
}

function HeatPanel({
  title,
  sub,
  metrics,
  grid,
  err,
  selected,
  onSelect,
}: {
  title: string;
  sub: string;
  metrics: Metric[];
  grid: Grid | null;
  err: boolean;
  selected?: string;
  onSelect?: (w: string) => void;
}) {
  const { lang } = usePrefs();
  const [m, setM] = useState(metrics[0].key);
  const metric = metrics.find((x) => x.key === m)!;
  return (
    <div className="wf-card wf-heat" data-reveal>
      <div className="wf-between" style={{ marginBottom: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div className="wf-h2">{title}</div>
          <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            {sub}
          </div>
        </div>
        <div className="wf-tabs">
          {metrics.map((x) => (
            <button key={x.key} className={`wf-tab ${m === x.key ? "on" : ""}`} style={{ height: 26, padding: "0 10px" }} onClick={() => setM(x.key)}>
              {x.label[lang]}
            </button>
          ))}
        </div>
      </div>
      {err ? (
        <div className="wf-empty">—</div>
      ) : !grid ? (
        <div className="wf-skel" style={{ height: 10 * ROW_H + 50 }} />
      ) : (
        <HeatCanvas grid={grid} metric={metric} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

const TXT = {
  rates: { az: "Hasilat istilik xəritəsi", en: "Production heatmap", ru: "Тепловая карта добычи" },
  ratesSub: { az: "Quyu × gün · VFM proqnozu", en: "Well × day · VFM estimate", ru: "Скважина × день · оценка VFM" },
  sensors: { az: "Təzyiq istilik xəritəsi", en: "Pressure heatmap", ru: "Тепловая карта давления" },
  sensorsSub: { az: "Quyu × gün · təmizlənmiş sensorların gündəlik ortası", en: "Well × day · daily mean of cleaned sensors", ru: "Скважина × день · среднесуточно, очищенные датчики" },
};

/** Well × day heatmaps for production (needs VFM) and/or sensors (needs cleaning). */
export function FieldHeatmaps({
  wells,
  show,
  ratesVer,
  sensorsVer,
  ratesReady,
  sensorsReady,
  selected,
  onSelect,
}: {
  wells: string[];
  show: ("rates" | "sensors")[];
  ratesVer: string;
  sensorsVer: string;
  ratesReady: boolean;
  sensorsReady: boolean;
  selected?: string;
  onSelect?: (w: string) => void;
}) {
  const { lang } = usePrefs();
  const r = useGrid("rates", wells, ratesVer, ratesReady && show.includes("rates"));
  const s = useGrid("sensors", wells, sensorsVer, sensorsReady && show.includes("sensors"));
  const panels = [
    show.includes("rates") && ratesReady && (
      <HeatPanel key="r" title={TXT.rates[lang]} sub={TXT.ratesSub[lang]} metrics={RATE_METRICS} grid={r.grid} err={r.err} selected={selected} onSelect={onSelect} />
    ),
    show.includes("sensors") && sensorsReady && (
      <HeatPanel key="s" title={TXT.sensors[lang]} sub={TXT.sensorsSub[lang]} metrics={SENSOR_METRICS} grid={s.grid} err={s.err} selected={selected} onSelect={onSelect} />
    ),
  ].filter(Boolean);
  if (!panels.length) return null;
  return <div className={`wf-grid ${panels.length === 2 ? "k2" : ""} wf-gap-lg`}>{panels}</div>;
}
