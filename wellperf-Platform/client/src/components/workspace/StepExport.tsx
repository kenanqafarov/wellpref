"use client";

import React from "react";
import { ArrowDownToLine, FileCode2, FileSpreadsheet, FileText, Package } from "lucide-react";
import { EngineStatus, exportUrl, fmt, fmtDate } from "./api";
import { SectionHead, useReveal } from "./ui";
import { usePrefs } from "./prefs";

const FILES: { name: string; key: string; needs: "vfm" | "pta"; icon: any; phase: string }[] = [
  { name: "vfm_predictions.xlsx", key: "f_vfm_xlsx", needs: "vfm", icon: FileSpreadsheet, phase: "phase1" },
  { name: "vfm_portal.csv", key: "f_vfm_csv", needs: "vfm", icon: FileText, phase: "phase1" },
  { name: "vfm_report.html", key: "f_vfm_html", needs: "vfm", icon: FileCode2, phase: "phase1" },
  { name: "pta_results.xlsx", key: "f_pta_xlsx", needs: "pta", icon: FileSpreadsheet, phase: "phase2" },
  { name: "pta_portal.csv", key: "f_pta_csv", needs: "pta", icon: FileText, phase: "phase2" },
  { name: "pta_report.html", key: "f_pta_html", needs: "pta", icon: FileCode2, phase: "phase2" },
];

export function StepExport({ status, onDownload }: { status: EngineStatus; onDownload: (name: string) => void }) {
  const { t } = usePrefs();
  const ref = useReveal<HTMLDivElement>([status.stages.vfm, status.stages.pta]);
  const ready = (n: "vfm" | "pta") => status.stages[n] === "done" && (n === "vfm" || (status.meta.pta?.results?.length || 0) > 0);
  const clean = status.meta.clean;
  return (
    <div ref={ref}>
      <SectionHead
        index={t("e_index")}
        title={t("e_title")}
        ghost={t("e_ghost")}
        lead={
          clean
            ? t("e_lead", {
                a: fmtDate(clean.period_start),
                b: fmtDate(clean.period_end),
                w: clean.wells?.length ?? 0,
                d: fmt(status.meta.vfm?.rows),
                s: status.meta.pta?.results?.length ?? 0,
              })
            : t("e_lead_empty")
        }
        actions={
          <a
            className="wf-btn primary"
            href={ready("vfm") ? exportUrl("wellperf_deliverables.zip") : undefined}
            onClick={() => ready("vfm") && onDownload("wellperf_deliverables.zip")}
            aria-disabled={!ready("vfm")}
            style={!ready("vfm") ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            <Package size={15} /> {t("e_all")}
          </a>
        }
      />
      <div className="wf-grid k3">
        {FILES.map((f) => {
          const ok = ready(f.needs);
          const Icon = f.icon;
          return (
            <div key={f.name} className="wf-card wf-file" data-reveal style={{ display: "flex", flexDirection: "column", gap: 14, opacity: ok ? 1 : 0.45 }}>
              <div className="wf-between">
                <div className="wf-drop-icon" style={{ margin: 0, width: 42, height: 42 }}>
                  <Icon size={18} />
                </div>
                <span className="wf-tag">{t(f.phase)}</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{t(f.key)}</div>
                <div className="mono dim" style={{ fontSize: 11, marginTop: 4 }}>
                  {f.name}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, flex: 1 }}>
                {t(`${f.key}_d`)}
              </div>
              <a className="wf-btn sm" href={ok ? exportUrl(f.name) : undefined} onClick={() => ok && onDownload(f.name)} style={!ok ? { pointerEvents: "none" } : { alignSelf: "flex-start" }}>
                <ArrowDownToLine size={14} /> {ok ? t("download") : t("e_first", { x: f.needs.toUpperCase() })}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
