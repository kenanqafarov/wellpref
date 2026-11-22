"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Play, RotateCcw, RotateCw } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { EngineStatus, engineGet, enginePost, fmt, fmtDate } from "./api";
import { ChartSkeleton, ChartTip, CountUp, SectionHead, Skeleton, StageBar, useReveal } from "./ui";
import { Palette, usePrefs } from "./prefs";

interface Props {
  status: EngineStatus;
  run: () => Promise<void>;
  running: boolean;
  goNext: () => void;
  notify: (t: string, type?: "ok" | "error") => void;
  refresh: () => Promise<void>;
}

type PlotMode = "loglog" | "horner" | "mdh" | "history";
const PLOTS: [PlotMode, string][] = [
  ["loglog", "p_loglog"],
  ["horner", "p_horner"],
  ["mdh", "p_mdh"],
  ["history", "p_hist"],
];

const qualityTag = (q: string) => (q === "good" ? "good" : q === "indicative" ? "warn" : "bad");
const sci = (v: number) => (v >= 100 ? fmt(v) : v >= 1 ? fmt(v, 1) : fmt(v, 2));

function LogTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="wf-tip mono">
      {Object.entries(p || {})
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]: any) => (
          <div key={k}>
            {k}: {v.toLocaleString("en-US", { maximumFractionDigits: 3 })}
          </div>
        ))}
    </div>
  );
}

function Plot({ d, mode, pal, t }: { d: any; mode: PlotMode; pal: Palette; t: (k: string) => string }) {
  const H = 380;
  const axisLabel = { fill: pal.ink3, fontSize: 11 };
  if (mode === "loglog") {
    const dp = d.loglog.dte.map((x: number, i: number) => ({ t: x, v: d.loglog.dp[i] })).filter((p: any) => p.t > 0 && p.v > 0);
    const dv = d.loglog.dte.map((x: number, i: number) => ({ t: x, v: d.loglog.deriv[i] })).filter((p: any) => p.t > 0 && p.v > 0);
    const [a, b] = d.loglog.iarf;
    const lvl = [
      { t: a, v: d.loglog.level },
      { t: b, v: d.loglog.level },
    ];
    const t0 = dp[0];
    const unit = t0 ? [{ t: t0.t, v: t0.v }, { t: t0.t * 10, v: t0.v * 10 }] : [];
    return (
      <ResponsiveContainer height={H}>
        <ScatterChart margin={{ top: 10, right: 16, left: 4, bottom: 18 }}>
          <CartesianGrid />
          <XAxis dataKey="t" type="number" scale="log" domain={["auto", "auto"]} allowDataOverflow tickFormatter={sci} label={{ value: "Δte (h)", position: "insideBottom", offset: -10, ...axisLabel }} />
          <YAxis dataKey="v" type="number" scale="log" domain={["auto", "auto"]} allowDataOverflow tickFormatter={sci} width={56} label={{ value: "Δp, Δp' (psi)", angle: -90, position: "insideLeft", ...axisLabel }} />
          <Tooltip content={<LogTip />} />
          <ReferenceArea x1={a} x2={b} fill={pal.accentSoft} strokeOpacity={0} />
          <Scatter name={t("p_dp")} data={dp} fill={pal.press} isAnimationActive={false} />
          <Scatter name={t("p_deriv")} data={dv} fill={pal.deriv} isAnimationActive={false} />
          <Scatter name={t("p_iarf")} data={lvl} line={{ stroke: pal.accent, strokeWidth: 3 }} shape={() => <g />} isAnimationActive={false} />
          <Scatter name={t("p_unit")} data={unit} line={{ stroke: pal.ink3, strokeDasharray: "4 4" }} shape={() => <g />} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (mode === "horner" || mode === "mdh") {
    const src = mode === "horner" ? d.horner : d.mdh;
    const xs: number[] = mode === "horner" ? src.ht : src.dt;
    const pts = xs.map((x: number, i: number) => ({ x, p: src.pws[i] })).filter((p: any) => p.x > 0 && p.p != null);
    const [lo, hi] = src.iarf_idx;
    const iarf = xs.slice(lo, hi + 1).map((x: number, i: number) => ({ x, p: src.pws[lo + i] }));
    const line = mode === "horner" ? d.horner.line.x.map((x: number, i: number) => ({ x, p: d.horner.line.y[i] })) : [];
    return (
      <ResponsiveContainer height={H}>
        <ScatterChart margin={{ top: 10, right: 16, left: 4, bottom: 18 }}>
          <CartesianGrid />
          <XAxis
            dataKey="x"
            type="number"
            scale="log"
            domain={["auto", "auto"]}
            reversed={mode === "horner"}
            allowDataOverflow
            tickFormatter={sci}
            label={{ value: mode === "horner" ? "(tp + Δt)/Δt" : "Δt (h)", position: "insideBottom", offset: -10, ...axisLabel }}
          />
          <YAxis dataKey="p" type="number" domain={["auto", "auto"]} width={60} tickFormatter={(v) => fmt(v)} label={{ value: "pws (psia)", angle: -90, position: "insideLeft", ...axisLabel }} />
          <Tooltip content={<LogTip />} />
          <Scatter name={t("p_pws")} data={pts} fill={pal.press} isAnimationActive={false} />
          <Scatter name={t("p_iarf_pts")} data={iarf} fill={pal.accent} isAnimationActive={false} />
          {line.length > 0 && <Scatter name={t("p_line")} data={line} line={{ stroke: pal.deriv, strokeDasharray: "6 4", strokeWidth: 1.5 }} shape={() => <g />} isAnimationActive={false} />}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  const h = d.history;
  const byDay = new Map<string, number>();
  h.days.forEach((day: string, i: number) => byDay.set(day.slice(0, 10), h.oil[i]));
  const rows = h.t.map((x: string, i: number) => ({ t: x, p: h.p[i], oil: byDay.get(x.slice(0, 10)) ?? null }));
  const startIdx = rows.findIndex((r: any) => r.t >= d.shut_in_start);
  const endIdx = rows.findIndex((r: any) => r.t >= d.shut_in_end);
  return (
    <ResponsiveContainer height={H}>
      <ComposedChart data={rows} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="t" tickFormatter={(x) => fmtDate(x)} minTickGap={70} tickLine={false} axisLine={false} />
        <YAxis yAxisId="p" domain={["auto", "auto"]} width={58} tickFormatter={(v) => fmt(v)} tickLine={false} axisLine={false} />
        <YAxis yAxisId="q" orientation="right" width={52} tickFormatter={(v) => fmt(v)} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTip labelFmt={(x: string) => fmtDate(x, true)} />} />
        {startIdx >= 0 && <ReferenceArea yAxisId="p" x1={rows[startIdx].t} x2={rows[endIdx >= 0 ? endIdx : rows.length - 1].t} fill={pal.dangerSoft} strokeOpacity={0} />}
        <Area yAxisId="q" type="stepAfter" dataKey="oil" name={t("p_oil_daily")} stroke={pal.oil} strokeWidth={1.2} fill={pal.oil} fillOpacity={0.12} isAnimationActive={false} />
        <Line yAxisId="p" dataKey="p" name={t("p_dhp")} stroke={pal.press} strokeWidth={1.3} dot={false} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function StepPTA({ status, run, running, goNext, notify, refresh }: Props) {
  const { t, pal } = usePrefs();
  const st = status.stages.pta;
  const meta = status.meta.pta;
  const done = st === "done";
  const results: any[] = meta?.results || [];
  const pref = status.reference?.pta;
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [mode, setMode] = useState<PlotMode>("loglog");
  const [q, setQ] = useState("");
  const [ws, setWs] = useState("");
  const [we, setWe] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useReveal<HTMLDivElement>([done, results.length]);

  useEffect(() => {
    if (!done) return;
    if (!sel || !results.find((r) => r.event_id === sel)) setSel(results[0]?.event_id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, results.length]);

  useEffect(() => {
    if (!sel || !done) return;
    setDetail(null);
    engineGet(`/api/pta/${sel}`)
      .then((d) => {
        setDetail(d);
        setQ("");
        setWs("");
        setWe("");
      })
      .catch((e) => notify(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, done]);

  const override = async (reset = false) => {
    if (!sel) return;
    setBusy(true);
    try {
      const d = await enginePost(`/api/pta/${sel}/override`, reset ? { reset: true } : { q_oil_stbd: q || null, window_start_hours: ws || null, window_end_hours: we || null });
      setDetail(d);
      await refresh();
      notify(reset ? t("p_restored") : t("p_reanalysed"));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const r = detail?.result;
  const qLabel = (x: string) => t(`q_${x}`);

  return (
    <div ref={ref}>
      <SectionHead
        index={t("p_index")}
        title={t("p_title")}
        ghost={t("p_ghost")}
        lead={t("p_lead")}
        actions={
          <>
            <button className={`wf-btn ${done ? "" : "primary"}`} onClick={run} disabled={running || status.stages.vfm !== "done"}>
              {done ? <RotateCw size={14} /> : <Play size={14} />} {done ? t("rerun") : t("p_run")}
            </button>
            <button className={`wf-btn ${done ? "primary" : ""}`} onClick={goNext} disabled={!done}>
              {t("p_next")} <ArrowRight size={15} />
            </button>
          </>
        }
      />
      <StageBar running={running} label={t("p_bar")} />
      {st === "stale" && (
        <div className="wf-note" style={{ marginBottom: 24 }}>
          {t("p_stale")}
        </div>
      )}

      {running && !meta ? (
        <div className="wf-grid side">
          <ChartSkeleton h={440} />
          <div className="wf-card" style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} h={44} />
            ))}
          </div>
        </div>
      ) : !meta ? (
        <div className="wf-empty" data-reveal>
          {status.stages.vfm === "done" ? t("p_ready") : t("v_need")}
        </div>
      ) : results.length === 0 ? (
        <div className="wf-empty" data-reveal>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t("p_none")}</div>
          <div style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>
            {t("p_none_why", {
              a: fmtDate(status.meta.clean?.period_start),
              b: fmtDate(status.meta.clean?.period_end),
              d: status.meta.clean?.days ?? "—",
              w: (status.meta.clean?.wells || []).join(", ") || "—",
            })}
          </div>
          {meta.failed?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {meta.failed.map((f: any) => (
                <div key={f.event_id} className="mono" style={{ fontSize: 12 }}>
                  {f.event_id}: {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="wf-row" style={{ marginBottom: 20 }} data-reveal>
            {results.map((x) => (
              <button key={x.event_id} className={`wf-chip ${x.event_id === sel ? "on" : ""}`} onClick={() => setSel(x.event_id)}>
                {x.well_name} · {fmtDate(x.shut_in_start)}
              </button>
            ))}
          </div>

          <div className="wf-grid k4">
            {[
              ["p_perm", r?.permeability_md, "md", 1],
              ["p_skin", r?.skin, "", 2],
              ["p_slope", r?.horner_slope_psi_cycle, "psi/cycle", 2],
              ["p_dpskin", r?.delta_p_skin_psi, "psi", 1],
            ].map(([l, v, u, dec]: any) => (
              <div className="wf-kpi" key={l} data-reveal>
                <div className="label">{t(l)}</div>
                <div className="wf-kpi-value">
                  {r ? <CountUp value={v} decimals={dec} duration={0.8} /> : <Skeleton h={36} w="60%" />}
                  {u && <span className="wf-kpi-unit">{u}</span>}
                </div>
                {l === "p_perm" && r && (
                  <div className="wf-kpi-foot">
                    {t("p_wrange")} {fmt(r.k_min_md, 0)}–{fmt(r.k_max_md, 0)} md
                  </div>
                )}
                {l === "p_skin" && r && (
                  <div className="wf-kpi-foot">
                    {t("p_range")} {fmt(r.skin_min, 1)} … {fmt(r.skin_max, 1)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="wf-grid side wf-gap-lg">
            <div className="wf-card" data-reveal>
              <div className="wf-between" style={{ marginBottom: 12 }}>
                <div className="wf-tabs">
                  {PLOTS.map(([k, l]) => (
                    <button key={k} className={`wf-tab ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>
                      {t(l)}
                    </button>
                  ))}
                </div>
                {r && (
                  <span className={`wf-tag ${qualityTag(r.iarf_quality)}`}>
                    {t("p_radial")} · {qLabel(r.iarf_quality)}
                  </span>
                )}
              </div>
              {detail ? <Plot d={detail} mode={mode} pal={pal} t={t} /> : <ChartSkeleton h={380} />}
              {mode === "loglog" && (
                <div className="wf-legend" style={{ marginTop: 8 }}>
                  <span>
                    <i style={{ background: pal.press }} />
                    {t("p_dp")}
                  </span>
                  <span>
                    <i style={{ background: pal.deriv }} />
                    {t("p_deriv")}
                  </span>
                  <span>
                    <i style={{ background: pal.accent }} />
                    {t("p_iarf")}
                  </span>
                  <span>
                    <i style={{ background: pal.ink3 }} />
                    {t("p_unit")}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <div className="wf-card" data-reveal>
                <span className="wf-h2">{t("p_interp")}</span>
                {!detail ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    <Skeleton h={12} />
                    <Skeleton h={12} w="85%" />
                    <Skeleton h={12} w="70%" />
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    {detail.interpretation.map((n: string, i: number) => (
                      <div key={i} className="wf-note">
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="wf-card" data-reveal>
                <span className="wf-h2">{t("p_inputs")}</span>
                {!detail ? (
                  <Skeleton h={160} style={{ marginTop: 14 }} />
                ) : (
                  <table className="wf-table" style={{ marginTop: 10 }}>
                    <tbody>
                      {[
                        [t("p_q"), `${fmt(r.q_oil_stbd, 1)} STB/d`, detail.q_source === "override" ? "override" : "VFM"],
                        [t("p_tp"), `${fmt(r.tp_hours)} h`],
                        [t("p_pwf"), `${fmt(r.pwf_psia, 1)} psia`],
                        [t("p_pstar"), `${fmt(r.p_star_psia, 1)} psia`],
                        ["p1hr", `${fmt(r.p1hr_psia, 1)} psia`],
                        [t("p_window"), `${fmt(r.iarf_start_hours, 2)}–${fmt(r.iarf_end_hours, 2)} h`, r.window_source],
                        [t("p_r2"), fmt(r.horner_fit_r2, 4)],
                        [t("p_pi"), `${fmt(r.productivity_index_stbd_psi, 2)} STB/d/psi`],
                        [t("p_fe"), `${fmt((r.flow_efficiency || 0) * 100, 0)} %`],
                        [t("p_ri"), `${fmt(r.radius_of_investigation_ft)} ft`],
                        ["B · μ · h", `${detail.inputs.oil_fvf_rb_stb} · ${detail.inputs.oil_viscosity_cp} cp · ${detail.inputs.net_pay_ft} ft`],
                      ].map(([l, v, tag]) => (
                        <tr key={String(l)}>
                          <td className="muted">{l}</td>
                          <td className="num mono">
                            {v}{" "}
                            {tag && (
                              <span className="wf-tag" style={{ marginLeft: 6 }}>
                                {tag}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="wf-card" data-reveal>
                <span className="wf-h2">{t("p_override")}</span>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                  {t("p_override_sub")}
                </div>
                <div className="wf-grid k3" style={{ marginTop: 14, gap: 10 }}>
                  {[
                    ["q (STB/d)", q, setQ, r ? fmt(r.q_oil_stbd, 0) : ""],
                    [`${t("start")} (h)`, ws, setWs, r ? fmt(r.iarf_start_hours, 2) : ""],
                    [`${t("end")} (h)`, we, setWe, r ? fmt(r.iarf_end_hours, 2) : ""],
                  ].map(([l, v, set, ph]: any) => (
                    <div key={l}>
                      <div className="label" style={{ marginBottom: 6 }}>
                        {l}
                      </div>
                      <input className="wf-input mono" placeholder={ph} value={v} onChange={(e) => set(e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="wf-row" style={{ marginTop: 14 }}>
                  <button className="wf-btn sm primary" disabled={busy || (!q && !(ws && we))} onClick={() => override(false)}>
                    {t("apply")}
                  </button>
                  <button className="wf-btn sm" disabled={busy || (detail?.result?.window_source !== "manual" && detail?.q_source !== "override")} onClick={() => override(true)}>
                    <RotateCcw size={13} /> {t("auto")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="wf-card wf-gap-lg" data-reveal>
            <div className="wf-between" style={{ marginBottom: 8 }}>
              <span className="wf-h2">{t("p_all")}</span>
              <span className="label">{t("p_events", { n: results.length } as any)}</span>
            </div>
            <div className="wf-scroll">
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>{t("well")}</th>
                    <th>{t("p_shutin")}</th>
                    <th className="num">{t("p_slope")}</th>
                    <th className="num">k (md)</th>
                    <th className="num">{t("p_skin")}</th>
                    <th className="num">{t("p_dpskin")} (psi)</th>
                    <th>{t("p_radial")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((x) => (
                    <tr key={x.event_id} className={x.event_id === sel ? "sel" : ""} onClick={() => setSel(x.event_id)} style={{ cursor: "pointer" }}>
                      <td className="mono">{x.well_name}</td>
                      <td className="mono">{fmtDate(x.shut_in_start, true)}</td>
                      <td className="num mono">{fmt(x.horner_slope_psi_per_cycle, 3)}</td>
                      <td className="num mono">{fmt(x.permeability_md, 2)}</td>
                      <td className="num mono">{fmt(x.skin, 3)}</td>
                      <td className="num mono">{fmt(x.delta_p_skin_psi, 2)}</td>
                      <td>
                        <span className={`wf-tag ${qualityTag(x.iarf_quality)}`}>{qLabel(x.iarf_quality)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta.failed?.length > 0 && (
              <div className="dim mono" style={{ fontSize: 12, marginTop: 14 }}>
                {t("p_notanal")}: {meta.failed.map((f: any) => `${f.event_id} (${f.error})`).join(" · ")}
              </div>
            )}
          </div>

          {pref && pref.rows?.length > 0 && (
            <div className="wf-card wf-gap-lg" data-reveal style={{ borderColor: "var(--accent)" }}>
              <div className="wf-h2">{t("p_ref")}</div>
              <div className="dim mono" style={{ fontSize: 12, marginTop: 4, marginBottom: 10 }}>
                {t("p_ref_sub", { file: pref.file, n: pref.rows.length })}
              </div>
              <div className="wf-scroll">
                <table className="wf-table">
                  <thead>
                    <tr>
                      <th>{t("well")}</th>
                      {[
                        ["permeability_md", "k (md)"],
                        ["skin", t("p_skin")],
                        ["delta_p_skin_psi", t("p_dpskin")],
                        ["horner_slope", t("p_slope")],
                      ].map(([k, l]) => (
                        <th key={k} className="num" colSpan={3}>
                          {l}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th />
                      {Array.from({ length: 4 }).flatMap((_, i) => [
                        <th key={`o${i}`} className="num">
                          {t("p_ours")}
                        </th>,
                        <th key={`r${i}`} className="num">
                          {t("p_refv")}
                        </th>,
                        <th key={`d${i}`} className="num">
                          {t("p_diff")}
                        </th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {pref.rows.map((x: any) => (
                      <tr key={x.event_id} onClick={() => setSel(x.event_id)} style={{ cursor: "pointer" }}>
                        <td className="mono">{x.well_name}</td>
                        {["permeability_md", "skin", "delta_p_skin_psi", "horner_slope"].flatMap((k) => {
                          const diff = x[`${k}_diff_pct`];
                          const tone = diff == null ? "" : Math.abs(diff) < 5 ? "var(--oil)" : Math.abs(diff) < 20 ? "var(--warn)" : "var(--danger)";
                          return [
                            <td key={`${k}o`} className="num mono">
                              {fmt(x[`${k}_ours`], 2)}
                            </td>,
                            <td key={`${k}r`} className="num mono dim">
                              {fmt(x[`${k}_ref`], 2)}
                            </td>,
                            <td key={`${k}d`} className="num mono" style={{ color: tone }}>
                              {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff, 1)}`}
                            </td>,
                          ];
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
