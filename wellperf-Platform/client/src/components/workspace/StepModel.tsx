"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { engineGet, fmt } from "./api";
import { ChartSkeleton, Kpi, KpiSkeletons, SectionHead, TableSkeleton, useReveal } from "./ui";
import { usePrefs } from "./prefs";

const PHASES = [
  ["oil_rate_stbd", "oil"],
  ["water_rate_stbd", "water"],
  ["gas_rate_mscfd", "gas"],
] as const;

export function StepModel({ goNext, canNext }: { goNext: () => void; canNext: boolean }) {
  const { t, pal } = usePrefs();
  const [m, setM] = useState<any | null>(null);
  const [phase, setPhase] = useState<string>("oil_rate_stbd");
  const ref = useReveal<HTMLDivElement>([!!m]);

  useEffect(() => {
    engineGet("/api/model").then(setM).catch(() => setM(null));
  }, []);

  const color = (p: string) => (p === "oil_rate_stbd" ? pal.oil : p === "water_rate_stbd" ? pal.water : pal.gas);

  const metric = (rows: any[], target: string, vfmOnly: boolean) =>
    rows?.find((r) => r.target === target && (vfmOnly ? r.method === "VFM model" : r.method !== "VFM model"));

  const parity = useMemo(
    () => (m?.parity || []).map((r: any) => ({ x: r[`${phase}_actual`], y: r[`${phase}_vfm`], well: r.well_name })),
    [m, phase]
  );
  const range = useMemo(() => {
    const v = parity.flatMap((p: any) => [p.x, p.y]).filter((x: any) => typeof x === "number");
    if (!v.length) return [0, 1];
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const pad = (hi - lo) * 0.05;
    return [Math.max(0, lo - pad), hi + pad];
  }, [parity]);

  const sens = useMemo(
    () => (m?.sensitivities || []).map((r: any) => ({ well: r.well_name, v: r.liquid_pct_per_10psi_pwf })),
    [m]
  );
  const q = m?.error_quantiles?.oil_rate_stbd;

  return (
    <div ref={ref}>
      <SectionHead
        index={t("m_index")}
        title={t("m_title")}
        ghost={t("m_ghost")}
        lead={t("m_lead")}
        actions={
          <button className="wf-btn primary" onClick={goNext} disabled={!canNext}>
            {t("m_next")} <ArrowRight size={15} />
          </button>
        }
      />

      {!m ? (
        <>
          <KpiSkeletons />
          <div className="wf-grid k2 wf-gap-lg">
            <ChartSkeleton h={360} />
            <ChartSkeleton h={360} />
          </div>
        </>
      ) : (
        <>
          <div className="wf-grid k4">
            {[...PHASES, ["liquid_rate_stbd", "liquid"] as const].map(([k, l]) => {
              const held = metric(m.cv_metrics, k, true);
              const base = metric(m.cv_metrics, k, false);
              const fwd = metric(m.forward_metrics, k, true);
              const gain = held && base ? (1 - held.MAPE_pct / base.MAPE_pct) * 100 : null;
              return (
                <Kpi
                  key={k}
                  label={`${t(l)} · ${t("held_out")} MAPE`}
                  value={held?.MAPE_pct}
                  unit="%"
                  decimals={2}
                  color={k === "liquid_rate_stbd" ? "var(--accent)" : color(k)}
                  foot={`${t("forward")} ${fmt(fwd?.MAPE_pct, 2)}% · ${gain !== null ? `−${fmt(gain, 0)}% ${t("m_gain")}` : ""}`}
                />
              );
            })}
          </div>

          <div className="wf-grid k2 wf-gap-lg">
            <div className="wf-card" data-reveal>
              <div className="wf-between">
                <div>
                  <div className="wf-h2">{t("m_parity")}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {t("m_parity_sub", { n: m.parity.length })}
                  </div>
                </div>
                <div className="wf-tabs">
                  {PHASES.map(([k, l]) => (
                    <button key={k} className={`wf-tab ${phase === k ? "on" : ""}`} onClick={() => setPhase(k)}>
                      {t(l)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ height: 330, marginTop: 14 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 16 }}>
                    <CartesianGrid />
                    <XAxis type="number" dataKey="x" domain={range} tickFormatter={(v) => fmt(v)} name={t("m_measured")} label={{ value: t("m_measured"), position: "insideBottom", offset: -8, fill: pal.ink3, fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" domain={range} tickFormatter={(v) => fmt(v)} width={56} name={t("m_predicted")} label={{ value: t("m_predicted"), angle: -90, position: "insideLeft", fill: pal.ink3, fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <div className="wf-tip mono">
                            <div className="label">{payload[0].payload.well}</div>
                            <div>
                              {t("m_measured")}: {fmt(payload[0].payload.x, 1)}
                            </div>
                            <div>
                              {t("m_predicted")}: {fmt(payload[0].payload.y, 1)}
                            </div>
                          </div>
                        ) : null
                      }
                    />
                    <Scatter data={[{ x: range[0], y: range[0] }, { x: range[1], y: range[1] }]} line={{ stroke: pal.ink3, strokeDasharray: "4 4" }} shape={() => <g />} isAnimationActive={false} />
                    <Scatter data={parity} fill={color(phase)} fillOpacity={0.85} animationDuration={700} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="wf-card" data-reveal>
              <div className="wf-h2">{t("m_sens")}</div>
              <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>
                {t("m_sens_sub")}
              </div>
              <div style={{ height: 330, marginTop: 14 }}>
                <ResponsiveContainer>
                  <BarChart data={sens} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${fmt(v, 1)}%`} />
                    <YAxis type="category" dataKey="well" width={52} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "var(--hover)" }} content={({ active, payload }: any) => (active && payload?.length ? <div className="wf-tip mono">{payload[0].payload.well}: {fmt(payload[0].value, 2)}%</div> : null)} />
                    <Bar dataKey="v" fill={pal.accent} fillOpacity={0.85} radius={4} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="wf-grid side wf-gap-lg">
            <div className="wf-card" data-reveal>
              <div className="wf-h2">{t("m_val")}</div>
              <div className="dim" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 10 }}>
                {t("m_val_sub")}
              </div>
              {!m.cv_metrics ? (
                <TableSkeleton />
              ) : (
                <table className="wf-table">
                  <thead>
                    <tr>
                      <th>{t("m_method")}</th>
                      {PHASES.map(([k, l]) => (
                        <th key={k} className="num">
                          {t(l)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [`VFM · ${t("held_out")}`, m.cv_metrics, true],
                      [`${t("m_baseline")} · ${t("held_out")}`, m.cv_metrics, false],
                      [`VFM · ${t("forward")}`, m.forward_metrics, true],
                      [`${t("m_baseline")} · ${t("forward")}`, m.forward_metrics, false],
                    ].map(([label, rows, vf]: any) => (
                      <tr key={label} className={vf ? "sel" : ""}>
                        <td>{label}</td>
                        {PHASES.map(([k]) => (
                          <td key={k} className="num mono">
                            {fmt(metric(rows, k, vf)?.MAPE_pct, 2)}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="wf-card" data-reveal>
              <div className="wf-h2">{t("m_why")}</div>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <div className="wf-note">{t("m_why1")}</div>
                <div className="wf-note">{t("m_why2", { n: m.label_corrections })}</div>
                <div className="wf-note">{t("m_why4")}</div>
                {q && <div className="wf-note">{t("m_why3", { lo: fmt(q[0] * 100, 1), hi: fmt(q[1] * 100, 1) })}</div>}
              </div>
              <table className="wf-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>{t("m_shared")}</th>
                    <th className="num">{t("m_coef")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(m.shared_coefficients || {}).map(([k, v]: any) => (
                    <tr key={k}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {k}
                      </td>
                      <td className="num mono">{Number(v).toExponential(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
