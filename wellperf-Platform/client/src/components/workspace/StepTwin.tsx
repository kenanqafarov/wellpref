"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Layers, Maximize2, Minimize2, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { EngineStatus, fmt } from "./api";
import { SectionHead, useReveal } from "./ui";
import { usePrefs } from "./prefs";
import type { TwinWell } from "./FieldTwin";

class TwinBoundary extends React.Component<{ children: React.ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    return this.state.err ? (
      <div className="wf-empty" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        3D view unavailable
      </div>
    ) : (
      this.props.children
    );
  }
}

const FieldTwin = dynamic(() => import("./FieldTwin"), {
  ssr: false,
  loading: () => <div className="wf-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />,
});

interface Props {
  status: EngineStatus;
  well: string;
  setWell: (w: string) => void;
  goVFM: () => void;
  goPTA: () => void;
}

export function StepTwin({ status, well, setWell, goVFM, goPTA }: Props) {
  const { t } = usePrefs();
  const [rotate, setRotate] = useState(true);
  const [geo, setGeo] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [zoomKey, setZoomKey] = useState({ n: 0, f: 1 });
  const ref = useReveal<HTMLDivElement>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else stageRef.current?.requestFullscreen?.().catch(() => {});
  };

  const rows = useMemo(() => {
    const vfm = new Map<string, any>((status.meta.vfm?.per_well || []).map((r: any) => [r.well_name, r]));
    const pta = new Map<string, any[]>();
    (status.meta.pta?.results || []).forEach((r: any) => pta.set(r.well_name, [...(pta.get(r.well_name) || []), r]));
    const names: string[] = status.model?.wells || [];
    return names.map((n) => {
      const v = vfm.get(n);
      const events = pta.get(n) || [];
      const last = events[events.length - 1];
      return { name: n, oil: v?.oil ?? null, water: v?.water ?? null, gas: v?.gas ?? null, skin: last?.skin ?? null, k: last?.permeability_md ?? null, quality: last?.iarf_quality ?? null, events: events.length };
    });
  }, [status.meta.vfm, status.meta.pta, status.model]);

  const twinWells: TwinWell[] = useMemo(() => rows.map((r) => ({ name: r.name, oil: r.oil, skin: r.skin, quality: r.quality })), [rows]);
  const maxOil = Math.max(1, ...rows.map((r) => r.oil || 0));
  const sel = rows.find((r) => r.name === well);

  return (
    <div ref={ref}>
      <SectionHead
        index={t("tw_index")}
        title={t("tw_title")}
        ghost={t("tw_ghost")}
        lead={t("tw_lead")}
        actions={
          <>
            <button className="wf-btn sm" onClick={() => setRotate((v) => !v)}>
              {rotate ? <Pause size={13} /> : <Play size={13} />} {t("twin_rotate")}
            </button>
            <button className={`wf-btn sm ${geo ? "" : "primary"}`} onClick={() => setGeo((v) => !v)}>
              <Layers size={13} /> {t("twin_geo")}
            </button>
            <button className="wf-btn sm" aria-label="Zoom in" onClick={() => setZoomKey((z) => ({ n: z.n + 1, f: 0.82 }))}>
              <ZoomIn size={13} />
            </button>
            <button className="wf-btn sm" aria-label="Zoom out" onClick={() => setZoomKey((z) => ({ n: z.n + 1, f: 1.22 }))}>
              <ZoomOut size={13} />
            </button>
            <button className="wf-btn sm" onClick={() => setResetKey((k) => k + 1)}>
              <RotateCcw size={13} /> {t("twin_reset")}
            </button>
            <button className="wf-btn sm primary" onClick={toggleFull}>
              {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {t(full ? "tw_exit_full" : "tw_full")}
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gap: 16 }}>
        <div className="tw-stage tw-stage-xl" ref={stageRef} data-reveal style={{ background: "#0a1724", borderColor: "transparent" }}>
          <TwinBoundary>
            <FieldTwin
              wells={twinWells}
              background="#0a1724"
              autoRotate={rotate}
              showGeology={geo}
              resetKey={resetKey}
              zoomKey={zoomKey}
              selected={well}
              onSelect={setWell}
              wheelZoom={full}
              labels={{ oil: t("twin_oil"), skin: t("twin_skin"), none: t("twin_none") }}
            />
          </TwinBoundary>
          <div className="lp-twin-legend">
            <span>
              <i style={{ background: "#e8b21a" }} />
              {t("twin_l_jacket")}
            </span>
            <span>
              <i style={{ background: "#4a2709" }} />
              {t("twin_l_res")}
            </span>
            <span>
              <i style={{ background: "#ffb23e" }} />
              {t("twin_l_flow")}
            </span>
            <span className="dim">{t(full ? "tw_hint_full" : "tw_hint")}</span>
          </div>
          {full && (
            <button className="wf-btn sm tw-full-exit" onClick={toggleFull}>
              <Minimize2 size={13} /> {t("tw_exit_full")}
            </button>
          )}
        </div>

        <div className="tw-below">
          <div className="wf-card" data-reveal>
            <div className="label">{sel?.name || t("tw_wells")}</div>
            {!sel ? (
              <div className="dim" style={{ fontSize: 13, marginTop: 10 }}>
                {t("tw_select")}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, letterSpacing: "-0.04em", marginTop: 12, lineHeight: 1 }}>
                  {sel.oil != null ? fmt(sel.oil) : "—"}
                  <span className="wf-kpi-unit">STB/d</span>
                </div>
                <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                  {t("twin_oil")}
                </div>
                <table className="wf-table" style={{ marginTop: 14 }}>
                  <tbody>
                    {[
                      [t("tw_water"), sel.water != null ? `${fmt(sel.water)} STB/d` : "—"],
                      [t("tw_gas"), sel.gas != null ? `${fmt(sel.gas)} Mscf/d` : "—"],
                      [t("tw_k"), sel.k != null ? `${fmt(sel.k, 1)} md` : "—"],
                      [t("twin_skin"), sel.skin != null ? fmt(sel.skin, 2) : "—"],
                      [t("tw_quality"), sel.quality ? t(`q_${sel.quality}`) : "—"],
                    ].map(([l, v]) => (
                      <tr key={l}>
                        <td className="muted">{l}</td>
                        <td className="num mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sel.oil == null && (
                  <div className="dim" style={{ fontSize: 12, marginTop: 10 }}>
                    {t("twin_none")}
                  </div>
                )}
                <div className="wf-row" style={{ marginTop: 14 }}>
                  <button className="wf-btn sm" onClick={goVFM} disabled={status.stages.vfm !== "done"}>
                    {t("tw_open_vfm")} <ArrowRight size={12} />
                  </button>
                  <button className="wf-btn sm" onClick={goPTA} disabled={status.stages.pta !== "done" || !sel.events}>
                    {t("tw_open_pta")} <ArrowRight size={12} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="tw-wells" data-reveal>
            {rows.map((r) => (
              <button key={r.name} className={`tw-well ${r.name === well ? "on" : ""}`} onClick={() => setWell(r.name)}>
                <span className="mono" style={{ fontSize: 12 }}>
                  {r.name}
                </span>
                <span className="tw-bar">
                  <div style={{ width: `${r.oil ? (r.oil / maxOil) * 100 : 0}%` }} />
                </span>
                <span className="mono dim" style={{ fontSize: 11.5, minWidth: 64, textAlign: "right" }}>
                  {r.oil != null ? fmt(r.oil) : "—"}
                  {r.skin != null ? ` · s ${fmt(r.skin, 1)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
