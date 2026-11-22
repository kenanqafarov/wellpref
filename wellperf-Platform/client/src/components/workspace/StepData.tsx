"use client";

import React, { useRef, useState } from "react";
import { ArrowRight, Database, FileText, FileUp, Play, Trash2, UploadCloud } from "lucide-react";
import { EngineStatus, PART_KINDS, Part, engineDelete, enginePost, engineUpload, fmt, fmtDate } from "./api";
import { SectionHead, Skeleton, useReveal } from "./ui";
import { usePrefs } from "./prefs";

interface Props {
  status: EngineStatus | null;
  refresh: () => Promise<void>;
  notify: (text: string, type?: "ok" | "error") => void;
  runAll: () => Promise<void>;
  busy: boolean;
  goNext: () => void;
}

const DEMO_MONTHS = ["2025-07", "2025-08", "2025-09"];

function Timeline({ status }: { status: EngineStatus }) {
  const { t } = usePrefs();
  const sensorParts = status.parts.filter((p) => p.kind === "high_freq" && p.start && p.end);
  const hist = status.history;
  const showHist = !!hist && status.use_history;
  const times = [
    ...sensorParts.flatMap((p) => [new Date(p.start!).getTime(), new Date(p.end!).getTime()]),
    ...(showHist ? [new Date(hist!.start).getTime(), new Date(hist!.end).getTime()] : []),
  ];
  if (!times.length) return null;
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  const pos = (x: number) => ((x - lo) / Math.max(hi - lo, 1)) * 100;
  return (
    <div data-reveal>
      <div className="wf-between" style={{ marginBottom: 10 }}>
        <span className="label">{t("d_timeline")}</span>
        <span className="wf-legend">
          {showHist && (
            <span>
              <i style={{ background: "var(--line-2)" }} />
              {t("d_hist_ctx")}
            </span>
          )}
          <span>
            <i style={{ background: "var(--accent)" }} />
            {t("d_uploaded")}
          </span>
        </span>
      </div>
      <div className="wf-timeline">
        {showHist && (
          <div
            className="wf-timeline-seg hist"
            style={{ left: `${pos(new Date(hist!.start).getTime())}%`, width: `${pos(new Date(hist!.end).getTime()) - pos(new Date(hist!.start).getTime())}%` }}
          />
        )}
        {sensorParts.map((p) => (
          <div
            key={p.id}
            className="wf-timeline-seg new"
            title={`${p.filename}: ${fmtDate(p.start)} → ${fmtDate(p.end)}`}
            style={{
              left: `${pos(new Date(p.start!).getTime())}%`,
              width: `max(4px, ${pos(new Date(p.end!).getTime()) - pos(new Date(p.start!).getTime())}%)`,
              opacity: 0.9,
            }}
          />
        ))}
      </div>
      <div className="wf-between mono dim" style={{ fontSize: 11, marginTop: 8 }}>
        <span>{fmtDate(new Date(lo).toISOString())}</span>
        <span>{fmtDate(new Date(hi).toISOString())}</span>
      </div>
    </div>
  );
}

export function StepData({ status, refresh, notify, runAll, busy, goNext }: Props) {
  const { t } = usePrefs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const ref = useReveal<HTMLDivElement>([status?.ready]);

  const send = async (files: File[]) => {
    if (!files.length) return;
    setProgress(0);
    try {
      const res = await engineUpload(files, (p) => {
        setProgress(p);
        if (p >= 100) setProcessing(true);
      });
      if (res.errors?.length) notify(res.errors.map((e: any) => `${e.file}: ${e.error}`).join(" · "), "error");
      if (res.added?.length)
        notify(t("d_added", { n: res.added.length, kinds: res.added.map((a: Part) => t(`k_${a.kind}`)).join(", ") }));
      await refresh();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setProgress(null);
      setProcessing(false);
    }
  };

  const loadSampleFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessing(true);
      const res = await fetch("/sample_raw_well_telemetry.csv");
      const blob = await res.blob();
      const file = new File([blob], "sample_raw_well_telemetry.csv", { type: "text/csv" });
      await send([file]);
      notify("Sample telemetry uploaded & processed successfully!");
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setProcessing(false);
    }
  };

  const demo = async (month: string) => {
    try {
      setProcessing(true);
      await enginePost(`/api/demo/${month}`);
      notify(t("d_loaded_demo", { m: fmtDate(`${month}-01`).replace(/^\S+\s/, "") }));
      await refresh();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setProcessing(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await engineDelete(`/api/parts/${id}`);
      await refresh();
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const toggleHistory = async () => {
    if (!status) return;
    await enginePost("/api/settings", { use_history: !status.use_history });
    await refresh();
  };

  const parts = status?.parts || [];
  const hasSensors = parts.some((p) => p.kind === "high_freq");
  const model = status?.model;

  return (
    <div ref={ref}>
      <SectionHead
        index={t("d_index")}
        title={t("d_title")}
        ghost={t("d_ghost")}
        lead={t("d_lead")}
        actions={
          <>
            <button className="wf-btn" onClick={goNext} disabled={!hasSensors}>
              {t("step_by_step")} <ArrowRight size={15} />
            </button>
            <button className="wf-btn primary" onClick={runAll} disabled={!hasSensors || busy}>
              <Play size={14} /> {t("run_full")}
            </button>
          </>
        }
      />

      <div className="wf-grid side">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div
            data-reveal
            className={`wf-drop ${over ? "over" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              send(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept=".csv,.xlsx,.xls,.parquet,.zip"
              onChange={(e) => {
                send(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            <div className="wf-drop-icon">
              <UploadCloud size={22} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{t("d_drop")}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {t("d_drop_sub")}
            </div>
            <div className="wf-row" style={{ justifyContent: "center", marginTop: 18 }}>
              {PART_KINDS.map((k) => (
                <span key={k} className={`wf-tag ${k.endsWith("_ref") ? "" : ""}`} style={k.endsWith("_ref") ? { borderStyle: "dashed" } : undefined}>
                  {t(`k_${k}`)}
                </span>
              ))}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 14, maxWidth: 520, marginInline: "auto", lineHeight: 1.5 }}>
              {t("d_ref_hint")}
            </div>
            <div className="wf-row" style={{ justifyContent: "center", gap: 10, marginTop: 16 }}>
              <a
                href="/sample_raw_well_telemetry.csv"
                download="sample_raw_well_telemetry.csv"
                onClick={(e) => e.stopPropagation()}
                className="wf-chip"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <FileText size={13} />
                Download Test CSV
              </a>
              <button
                type="button"
                className="wf-chip"
                onClick={loadSampleFile}
                disabled={processing}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, borderColor: "var(--accent)", color: "var(--accent)", fontSize: 12, fontWeight: 500 }}
              >
                <Play size={13} />
                1-Click Load Test Telemetry (GL-01)
              </button>
            </div>
            {(progress !== null || processing) && (
              <div style={{ marginTop: 24, maxWidth: 360, marginInline: "auto" }}>
                <div className="wf-between label" style={{ marginBottom: 8 }}>
                  <span>{processing ? t("d_parsing") : t("d_uploading")}</span>
                  <span>{processing ? "" : `${progress}%`}</span>
                </div>
                <div className="wf-progress">{processing ? <div /> : <div style={{ width: `${progress}%`, animation: "none" }} />}</div>
              </div>
            )}
          </div>

          <div className="wf-card" data-reveal>
            <div className="wf-between" style={{ marginBottom: 6 }}>
              <span className="wf-h2">{t("d_parts")}</span>
              <span className="label">
                {parts.length} {t("files")}
              </span>
            </div>
            {!status ? (
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <Skeleton h={34} />
                <Skeleton h={34} />
              </div>
            ) : parts.length === 0 ? (
              <div className="wf-empty" style={{ marginTop: 14 }}>
                <FileUp size={20} style={{ marginBottom: 10 }} />
                <div>{t("d_empty")}</div>
              </div>
            ) : (
              <>
                <div style={{ margin: "14px 0 18px" }}>
                  <Timeline status={status} />
                </div>
                {parts.map((p, i) => (
                  <div key={p.id} className="wf-part">
                    <div className="wf-part-idx mono">{String(i + 1).padStart(2, "0")}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.filename}</div>
                      <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>
                        {fmt(p.rows)} {t("rows")} · {p.wells.length} {t("wells")}
                        {p.start ? ` · ${fmtDate(p.start)} → ${fmtDate(p.end)}` : ""}
                      </div>
                    </div>
                    <span className={`wf-tag ${p.kind === "high_freq" ? "acc" : ""}`} style={p.kind.endsWith("_ref") ? { borderStyle: "dashed" } : undefined}>
                      {t(`k_${p.kind}`)}
                    </span>
                    <button className="wf-btn sm ghost" onClick={() => remove(p.id)} title={t("remove_part")}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="wf-card" data-reveal>
            <div className="label">{t("d_model")}</div>
            {!model?.held_out_mape ? (
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <Skeleton h={28} w="60%" />
                <Skeleton h={12} />
                <Skeleton h={12} w="80%" />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 12, lineHeight: 1.4 }}>{t("d_model_name")}</div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                  {t("d_model_sub", { w: model.wells?.length ?? 0, n: model.n_tests ?? 0 })}
                </div>
                <table className="wf-table" style={{ marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>MAPE</th>
                      <th className="num">{t("held_out")}</th>
                      <th className="num">{t("forward")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["oil_rate_stbd", "oil", "var(--oil)"],
                      ["water_rate_stbd", "water", "var(--water)"],
                      ["gas_rate_mscfd", "gas", "var(--gas)"],
                    ].map(([k, l, c]) => (
                      <tr key={k}>
                        <td>
                          <span className="wf-dot" style={{ background: c, marginRight: 8 }} />
                          {t(l)}
                        </td>
                        <td className="num mono">{fmt(model.held_out_mape?.[k], 1)}%</td>
                        <td className="num mono">{fmt(model.forward_mape?.[k], 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="wf-card" data-reveal>
            <div className="wf-between">
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t("d_history")}</div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
                  {t("d_history_sub")}
                </div>
              </div>
              <button className={`wf-switch ${status?.use_history ? "on" : ""}`} onClick={toggleHistory} aria-label={t("d_history")} />
            </div>
            {status?.history && (
              <div className="mono dim" style={{ fontSize: 11, marginTop: 12 }}>
                <Database size={11} style={{ verticalAlign: -1, marginRight: 6 }} />
                {fmt(status.history.rows)} {t("rows")} · {fmtDate(status.history.start)} → {fmtDate(status.history.end)}
              </div>
            )}
          </div>

          <div className="wf-card" data-reveal>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t("d_rehearse")}</div>
            <div className="dim" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
              {t("d_rehearse_sub")}
            </div>
            <div className="wf-row" style={{ marginTop: 14 }}>
              {DEMO_MONTHS.map((m) => (
                <button key={m} className="wf-chip" onClick={() => demo(m)} disabled={!status?.ready || processing}>
                  + {fmtDate(`${m}-01`).replace(/^\S+\s/, "")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
