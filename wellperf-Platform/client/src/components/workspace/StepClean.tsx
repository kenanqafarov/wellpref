"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, RotateCw } from "lucide-react";
import { Area, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { EngineStatus, engineGet, fmt, fmtDate, tickDate } from "./api";
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

const SENSORS: [string, string][] = [
  ["dh_pressure_psia", "psia"],
  ["dh_temperature_degf", "°F"],
  ["whp_psia", "psia"],
  ["annulus_pressure_psia", "psia"],
  ["gas_lift_rate_mscfd", "Mscf/d"],
  ["choke_opening_pct", "%"],
];

export function StepClean({ status, run, running, goNext, well, setWell }: Props) {
  const { t, pal } = usePrefs();
  const st = status.stages.clean;
  const meta = status.meta.clean;
  const done = st === "done";
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useReveal<HTMLDivElement>([done, meta?.period_start]);
  const wells: string[] = meta?.wells || [];

  useEffect(() => {
    if (!done || !well) return;
    setLoading(true);
    setErr(null);
    engineGet(`/api/wells/${well}/sensors?resolution=1h`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [done, well, meta?.period_start, meta?.rows_uploaded]);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = data.series;
    return s.t.map((x: string, i: number) => {
      const r: any = { t: x };
      SENSORS.forEach(([k]) => (r[k] = s[k]?.[i] ?? null));
      return r;
    });
  }, [data]);

  const qc = data?.qc?.[0];
  const totalFlags = meta ? Object.entries(meta.flags || {}).reduce((a: number, [k, v]: any) => (k === "gaps" ? a : a + v), 0) : 0;

  return (
    <div ref={ref}>
      <SectionHead
        index={t("c_index")}
        title={t("c_title")}
        ghost={t("c_ghost")}
        lead={t("c_lead")}
        actions={
          <>
            <button className={`wf-btn ${done ? "" : "primary"}`} onClick={run} disabled={running}>
              {done ? <RotateCw size={14} /> : <Play size={14} />} {done ? t("rerun") : t("c_run")}
            </button>
            <button className={`wf-btn ${done ? "primary" : ""}`} onClick={goNext} disabled={!done}>
              {t("c_next")} <ArrowRight size={15} />
            </button>
          </>
        }
      />

      <StageBar running={running} label={t("c_bar")} />
      {st === "stale" && (
        <div className="wf-note" style={{ marginBottom: 24 }}>
          {t("c_stale")}
        </div>
      )}

      {running && !meta ? (
        <>
          <KpiSkeletons />
          <div className="wf-gap-lg">
            <ChartSkeleton h={380} />
          </div>
        </>
      ) : !meta ? (
        <div className="wf-empty" data-reveal>
          {t("c_notrun", { n: status.parts.filter((p) => p.kind === "high_freq").length })}
        </div>
      ) : (
        <>
          <div className="wf-grid k4">
            <Kpi label={t("c_rows")} value={meta.rows_uploaded} foot={t("c_rows_foot", { n: fmt(meta.context_rows) })} />
            <Kpi label={t("c_period")} value={meta.days} unit={t("days")} foot={`${fmtDate(meta.period_start)} → ${fmtDate(meta.period_end)}`} />
            <Kpi
              label={t("c_flagged")}
              value={totalFlags}
              foot={t("c_flagged_foot", { s: fmt(meta.flags.sentinel), p: fmt(meta.flags.spike), f: fmt(meta.flags.frozen) })}
            />
            <Kpi label={t("c_shutins")} value={meta.shut_ins} color="var(--accent)" foot={t("c_shutins_foot", { u: meta.upsets, c: meta.choke_source })} />
          </div>

          <div className="wf-between wf-gap-lg" style={{ marginBottom: 16 }} data-reveal>
            <span className="wf-h2">{t("c_field")}</span>
            <div className="wf-row">
              {wells.map((w) => (
                <button key={w} className={`wf-chip ${w === well ? "on" : ""}`} onClick={() => setWell(w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          {loading || !data ? (
            err ? (
              <div className="wf-empty">{err}</div>
            ) : (
              <div className="wf-grid k2">
                {SENSORS.map(([k]) => (
                  <ChartSkeleton key={k} h={210} />
                ))}
              </div>
            )
          ) : (
            <>
              <div className="wf-legend" style={{ marginBottom: 12 }} data-reveal>
                <span>
                  <i style={{ background: pal.dangerSoft }} />
                  {t("c_shutin")} ({data.shut_ins.length})
                </span>
                <span>
                  <i style={{ background: pal.warnSoft }} />
                  {t("c_upset")} ({data.upsets.length})
                </span>
                <span className="dim">{t("c_hourly")}</span>
              </div>
              <div className="wf-grid k2">
                {SENSORS.map(([k, unit], idx) => {
                  const color = idx === 0 ? pal.accent : pal.ink;
                  return (
                    <div className="wf-card" key={k} data-reveal style={{ padding: "18px 18px 8px" }}>
                      <div className="wf-between">
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t(`sn_${k}`)}</span>
                        <span className="label">{unit}</span>
                      </div>
                      <div style={{ height: 170, marginTop: 8 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={rows} syncId="sensors" margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="t" tickFormatter={tickDate} minTickGap={50} tickLine={false} axisLine={false} />
                            <YAxis domain={["auto", "auto"]} width={48} tickLine={false} axisLine={false} tickFormatter={(v) => (Math.abs(v) < 1000 ? fmt(v, 1) : fmt(v))} />
                            <Tooltip content={<ChartTip labelFmt={(x: string) => fmtDate(x, true)} />} />
                            {data.shut_ins.map((e: any) => (
                              <ReferenceArea key={e.event_id} x1={nearest(rows, e.shut_in_start)} x2={nearest(rows, e.shut_in_end)} fill={pal.dangerSoft} strokeOpacity={0} />
                            ))}
                            {data.upsets.map((u: any, i: number) => (
                              <ReferenceArea key={i} x1={nearest(rows, u.start)} x2={nearest(rows, u.end)} fill={pal.warnSoft} strokeOpacity={0} />
                            ))}
                            <Area type="monotone" dataKey={k} name={t(`sn_${k}`)} stroke="none" fill={`url(#g-${k})`} isAnimationActive={false} connectNulls={false} />
                            <Line type="monotone" dataKey={k} name={t(`sn_${k}`)} stroke={color} strokeWidth={1.3} dot={false} isAnimationActive={false} connectNulls={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="wf-grid k2 wf-gap-lg">
            <div className="wf-card" data-reveal>
              <div className="wf-between" style={{ marginBottom: 8 }}>
                <span className="wf-h2">{t("c_events")}</span>
                <span className="label">{well}</span>
              </div>
              {!data ? (
                <TableSkeleton rows={3} />
              ) : data.shut_ins.length === 0 ? (
                <div className="dim" style={{ fontSize: 13, padding: "16px 0" }}>
                  {t("c_no_events", { w: well })}
                </div>
              ) : (
                <table className="wf-table">
                  <thead>
                    <tr>
                      <th>{t("start")}</th>
                      <th>{t("end")}</th>
                      <th className="num">{t("hours")}</th>
                      <th>{t("source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shut_ins.map((e: any) => (
                      <tr key={e.event_id}>
                        <td className="mono">{fmtDate(e.shut_in_start, true)}</td>
                        <td className="mono">{fmtDate(e.shut_in_end, true)}</td>
                        <td className="num mono">{fmt(e.duration_hours, 1)}</td>
                        <td>
                          <span className="wf-tag">{e.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="wf-card" data-reveal>
              <div className="wf-between" style={{ marginBottom: 8 }}>
                <span className="wf-h2">{t("c_quality")}</span>
                <span className="label">{well}</span>
              </div>
              {!qc ? (
                <TableSkeleton rows={4} />
              ) : (
                <table className="wf-table">
                  <tbody>
                    {[
                      [t("q_raw"), qc.rows_raw],
                      [t("q_dup"), qc.duplicates_removed],
                      [t("q_order"), qc.out_of_order_rows],
                      [t("q_gaps"), `${fmt(qc.gap_count)} (${t("q_longest")} ${fmt(qc.longest_gap_hours, 1)} h)`],
                      [t("q_sent"), sensSum(qc, "sentinel")],
                      [t("q_spike"), sensSum(qc, "spike")],
                      [t("q_frozen"), sensSum(qc, "frozen")],
                      [t("q_flag"), `${fmt(qc.pct_values_flagged, 2)} %`],
                    ].map(([l, v]) => (
                      <tr key={String(l)}>
                        <td className="muted">{l}</td>
                        <td className="num mono">{typeof v === "number" ? fmt(v) : v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function sensSum(qc: any, kind: string) {
  return Object.entries(qc)
    .filter(([k]) => k.endsWith(`__${kind}`))
    .reduce((a, [, v]) => a + (Number(v) || 0), 0);
}

/** ReferenceArea needs x values that exist on the categorical axis. */
function nearest(rows: any[], iso: string | null) {
  if (!rows.length) return undefined;
  if (!iso) return rows[rows.length - 1].t;
  const target = new Date(iso).getTime();
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (new Date(rows[mid].t).getTime() < target) lo = mid + 1;
    else hi = mid;
  }
  return rows[lo].t;
}
