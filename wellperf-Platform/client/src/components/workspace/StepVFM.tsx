"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, RotateCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { EngineStatus, engineGet, enginePost, fmt, fmtDate, tickDate } from "./api";
import { ChartSkeleton, ChartTip, Kpi, KpiSkeletons, SectionHead, StageBar, TableSkeleton, useReveal } from "./ui";
import { usePrefs } from "./prefs";

interface Props {
  status: EngineStatus;
  run: () => Promise<void>;
  running: boolean;
  goNext: () => void;
  well: string;
  setWell: (w: string) => void;
}

const PHASES = [
  ["oil_rate_stbd", "oil", "STB/d"],
  ["water_rate_stbd", "water", "STB/d"],
  ["gas_rate_mscfd", "gas", "Mscf/d"],
] as const;

export function StepVFM({ status, run, running, goNext, well, setWell }: Props) {
  const { t, pal } = usePrefs();
  const st = status.stages.vfm;
  const meta = status.meta.vfm;
  const done = st === "done";
  const wells: string[] = status.meta.clean?.wells || [];
  const [field, setField] = useState<any[] | null>(null);
  const [wellData, setWellData] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [phase, setPhase] = useState<string>("oil_rate_stbd");
  const ref = useReveal<HTMLDivElement>([done, meta?.rows]);
  const colorOf = (k: string) => (k === "oil_rate_stbd" ? pal.oil : k === "water_rate_stbd" ? pal.water : pal.gas);
  const vref = status.reference?.vfm;

  useEffect(() => {
    if (!done) return;
    setField(null);
    setPreview(null);
    engineGet("/api/field/rates").then((d) => setField(d.rows)).catch(() => setField([]));
    engineGet("/api/preview/vfm?limit=60").then(setPreview).catch(() => setPreview(null));
  }, [done, meta?.rows, meta?.cum_oil]);

  useEffect(() => {
    if (!done || !well) return;
    setWellData(null);
    engineGet(`/api/wells/${well}/rates`).then(setWellData).catch(() => setWellData({ rows: [], tests: [] }));
  }, [done, well, meta?.cum_oil]);

  const wellRows = useMemo(() => {
    if (!wellData) return [];
    const tests = new Map<string, any>();
    (wellData.tests || []).forEach((x: any) => tests.set(String(x.test_start).slice(0, 10), x));
    return wellData.rows.map((r: any) => {
      const x = tests.get(String(r.date).slice(0, 10));
      return { ...r, band: r[`${phase}_p10`] != null ? [r[`${phase}_p10`], r[`${phase}_p90`]] : null, test: x ? x[phase] : null };
    });
  }, [wellData, phase]);

  const ph = PHASES.find((p) => p[0] === phase)!;
  const acc = meta?.accuracy_vs_uploaded_tests;
  const c = colorOf(phase);

  return (
    <div ref={ref}>
      <SectionHead
        index={t("v_index")}
        title={t("v_title")}
        ghost={t("v_ghost")}
        lead={t("v_lead")}
        actions={
          <>
            <button className={`wf-btn ${done ? "" : "primary"}`} onClick={run} disabled={running || status.stages.clean !== "done"}>
              {done ? <RotateCw size={14} /> : <Play size={14} />} {done ? t("rerun") : t("v_run")}
            </button>
            <button className={`wf-btn ${done ? "primary" : ""}`} onClick={goNext} disabled={!done}>
              {t("v_next")} <ArrowRight size={15} />
            </button>
          </>
        }
      />

      <StageBar running={running} label={t("v_bar")} />
      {st === "stale" && (
        <div className="wf-note" style={{ marginBottom: 24 }}>
          {t("v_stale")}
        </div>
      )}

      {running && !meta ? (
        <>
          <KpiSkeletons />
          <div className="wf-gap-lg">
            <ChartSkeleton h={360} />
          </div>
        </>
      ) : !meta ? (
        <div className="wf-empty" data-reveal>
          {status.stages.clean === "done" ? t("v_ready") : t("v_need")}
        </div>
      ) : (
        <>
          <div className="wf-grid k4">
            <Kpi label={t("v_field_oil")} value={meta.field_oil} unit="STB/d" color="var(--oil)" foot={t("v_predicted_days", { n: fmt(meta.rows) })} />
            <Kpi label={t("v_field_water")} value={meta.field_water} unit="STB/d" color="var(--water)" />
            <Kpi label={t("v_field_gas")} value={meta.field_gas} unit="Mscf/d" color="var(--gas)" />
            <Kpi
              label={acc ? t("v_err_tests") : t("v_cum")}
              value={acc ? acc.oil_rate_stbd : meta.cum_oil}
              unit={acc ? "% MAPE" : "STB"}
              decimals={acc ? 2 : 0}
              color="var(--accent)"
              foot={acc ? `${acc.n_tests} · ${t("water")} ${fmt(acc.water_rate_stbd, 1)}% · ${t("gas")} ${fmt(acc.gas_rate_mscfd, 1)}%` : t("v_cum_foot")}
            />
          </div>

          {(meta.recalibration || status.parts.some((p) => p.kind === "tests")) && (
            <div className="wf-card wf-gap-lg" data-reveal>
              <div className="wf-between">
                <div style={{ maxWidth: 640 }}>
                  <div className="wf-h2">{t("v_recal")}</div>
                  <div className="dim" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
                    {meta.recalibration
                      ? t("v_recal_on", { n: meta.recalibration.tests_added, total: meta.recalibration.tests_total })
                      : (status as any).recalibrate
                      ? t("v_recal_none")
                      : t("v_recal_off")}
                  </div>
                </div>
                <div className="wf-row" style={{ gap: 28 }}>
                  {meta.recalibration?.loo_mape &&
                    PHASES.map(([k, l]) => (
                      <div key={k}>
                        <div className="label" style={{ color: colorOf(k) }}>
                          {t(l)} · LOTO
                        </div>
                        <div style={{ fontSize: 26, letterSpacing: "-0.03em", marginTop: 6 }}>{fmt(meta.recalibration.loo_mape[k], 2)}%</div>
                      </div>
                    ))}
                  <button
                    className={`wf-switch ${(status as any).recalibrate ? "on" : ""}`}
                    aria-label={t("v_recal")}
                    disabled={running}
                    onClick={async () => {
                      await enginePost("/api/settings", { recalibrate: !(status as any).recalibrate });
                      await run();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {vref && (
            <div className="wf-card wf-gap-lg" data-reveal style={{ borderColor: "var(--accent)" }}>
              <div className="wf-between">
                <div>
                  <div className="wf-h2">{t("v_ref")}</div>
                  <div className="dim mono" style={{ fontSize: 12, marginTop: 4 }}>
                    {t("v_ref_sub", { file: vref.file, n: vref.rows_matched })}
                  </div>
                </div>
                <div className="wf-row" style={{ gap: 28 }}>
                  {PHASES.map(([k, l]) => (
                    <div key={k}>
                      <div className="label" style={{ color: colorOf(k) }}>
                        {t(l)} · {t("v_mape")}
                      </div>
                      <div style={{ fontSize: 28, letterSpacing: "-0.03em", marginTop: 6 }}>{fmt(vref.phases?.[k]?.mape, 2)}%</div>
                      <div className="dim mono" style={{ fontSize: 11 }}>
                        {t("v_bias")} {fmt(vref.phases?.[k]?.bias_pct, 2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="wf-card wf-gap-lg" data-reveal>
            <div className="wf-between">
              <span className="wf-h2">{t("v_field")}</span>
              <span className="wf-legend">
                {PHASES.map(([k, l]) => (
                  <span key={k}>
                    <i style={{ background: colorOf(k) }} />
                    {t(l)}
                  </span>
                ))}
              </span>
            </div>
            <div style={{ height: 280, marginTop: 16 }}>
              {!field ? (
                <ChartSkeleton h={260} />
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={field} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      {PHASES.map(([k]) => (
                        <linearGradient key={k} id={`f-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colorOf(k)} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={colorOf(k)} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={40} tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmt(v)} />
                    <Tooltip content={<ChartTip labelFmt={(x: string) => fmtDate(x)} />} />
                    {PHASES.map(([k, l]) => (
                      <Area key={k} type="monotone" dataKey={k} name={t(l)} stroke={colorOf(k)} strokeWidth={1.5} fill={`url(#f-${k})`} animationDuration={900} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="wf-between wf-gap-lg" style={{ marginBottom: 16 }} data-reveal>
            <div className="wf-tabs">
              {PHASES.map(([k, l]) => (
                <button key={k} className={`wf-tab ${phase === k ? "on" : ""}`} onClick={() => setPhase(k)}>
                  {t(l)}
                </button>
              ))}
            </div>
            <div className="wf-row">
              {wells.map((w) => (
                <button key={w} className={`wf-chip ${w === well ? "on" : ""}`} onClick={() => setWell(w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="wf-grid side">
            <div className="wf-card" data-reveal>
              <div className="wf-between">
                <span className="wf-h2">
                  {well} · {t(ph[1])}
                </span>
                <span className="wf-legend">
                  <span>
                    <i style={{ background: c }} />
                    {t("v_daily")}
                  </span>
                  <span>
                    <i style={{ background: c, opacity: 0.25 }} />
                    {t("v_band")}
                  </span>
                  {wellData?.tests?.length > 0 && (
                    <span>
                      <i style={{ background: pal.ink, borderRadius: 999 }} />
                      {t("v_test")}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ height: 300, marginTop: 16 }}>
                {!wellData ? (
                  <ChartSkeleton h={280} />
                ) : (
                  <ResponsiveContainer>
                    <ComposedChart data={wellRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={40} tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v)} />
                      <Tooltip content={<ChartTip labelFmt={(x: string) => fmtDate(x)} />} />
                      <Area dataKey="band" name={t("v_band")} stroke="none" fill={c} fillOpacity={0.14} isAnimationActive={false} />
                      <Line dataKey={phase} name={`VFM ${t(ph[1])}`} stroke={c} strokeWidth={2} dot={false} animationDuration={900} />
                      <Scatter dataKey="test" name={t("v_test")} fill={pal.ink} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="wf-card" data-reveal>
              <span className="wf-h2">{t("v_avg")}</span>
              <table className="wf-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>{t("well")}</th>
                    <th className="num">{t("oil")}</th>
                    <th className="num">{t("water")}</th>
                    <th className="num">{t("gas")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(meta.per_well || []).map((r: any) => (
                    <tr key={r.well_name} className={r.well_name === well ? "sel" : ""} onClick={() => setWell(r.well_name)} style={{ cursor: "pointer" }}>
                      <td className="mono">{r.well_name}</td>
                      <td className="num mono">{fmt(r.oil)}</td>
                      <td className="num mono">{fmt(r.water)}</td>
                      <td className="num mono">{fmt(r.gas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="wf-card wf-gap-lg" data-reveal>
            <div className="wf-between" style={{ marginBottom: 8 }}>
              <span className="wf-h2">{t("v_preview")}</span>
              <span className="label">
                date · well_name · oil_rate_stbd · water_rate_stbd · gas_rate_mscfd — {fmt(preview?.total)} {t("rows")}
              </span>
            </div>
            {!preview ? (
              <TableSkeleton rows={5} />
            ) : (
              <div className="wf-scroll" style={{ maxHeight: 320 }}>
                <table className="wf-table">
                  <thead>
                    <tr>
                      <th>date</th>
                      <th>well_name</th>
                      <th className="num">oil_rate_stbd</th>
                      <th className="num">water_rate_stbd</th>
                      <th className="num">gas_rate_mscfd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="mono">{r.date}</td>
                        <td className="mono">{r.well_name}</td>
                        <td className="num mono">{fmt(r.oil_rate_stbd, 1)}</td>
                        <td className="num mono">{fmt(r.water_rate_stbd, 1)}</td>
                        <td className="num mono">{fmt(r.gas_rate_mscfd, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {meta.status_counts && (
              <div className="wf-row" style={{ marginTop: 16 }}>
                {Object.entries(meta.status_counts).map(([k, v]: any) => (
                  <span key={k} className={`wf-tag ${k === "sensor-based" ? "good" : k.includes("interpolated") ? "warn" : ""}`}>
                    {k} · {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
