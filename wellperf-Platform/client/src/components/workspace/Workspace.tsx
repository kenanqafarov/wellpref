"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check, Home, PanelLeftClose, PanelLeftOpen, RotateCcw, Sparkles, Terminal } from "lucide-react";
import { EngineStatus, StageName, engineGet, enginePost, fmtDate } from "./api";
import { StepData } from "./StepData";
import { StepClean } from "./StepClean";
import { StepModel } from "./StepModel";
import { StepVFM } from "./StepVFM";
import { StepPTA } from "./StepPTA";
import { StepExport } from "./StepExport";
import { StepTwin } from "./StepTwin";
import { FieldHeatmaps } from "./Heatmaps";
import { Skeleton } from "./ui";
import { PrefsControls, usePrefs } from "./prefs";
import { OnboardingTour } from "@/components/OnboardingTour";

type StepId = "data" | "clean" | "model" | "vfm" | "pta" | "twin" | "export";
const STEPS: StepId[] = ["data", "clean", "model", "vfm", "pta", "twin", "export"];

export default function Workspace({ onHome }: { onHome?: () => void }) {
  const { t, theme, cssVars, lang } = usePrefs();
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [step, setStep] = useState<StepId>("data");
  const [running, setRunning] = useState<StageName | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "ok" | "error" } | null>(null);
  const [well, setWell] = useState("GL-01");
  const [showLog, setShowLog] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("wp_rail_collapsed") === "1");
    } catch {}
  }, []);
  const toggleRail = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem("wp_rail_collapsed", v ? "0" : "1");
      } catch {}
      return !v;
    });
  const contentRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<any>(null);

  useEffect(() => {
    try {
      const tourSeen = localStorage.getItem("wellperf_tour_completed");
      if (!tourSeen) {
        setShowTour(true);
      }
    } catch {}
  }, []);

  const notify = useCallback((text: string, type: "ok" | "error" = "ok") => {
    setToast({ text, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), type === "error" ? 6000 : 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await engineGet<EngineStatus>("/api/status");
      setStatus(s);
      setOffline(false);
      if (s.meta?.clean?.wells?.length) setWell((w) => (s.meta.clean.wells.includes(w) ? w : s.meta.clean.wells[0]));
    } catch {
      setOffline(true);
    }
  }, []);

  // Poll fast while the engine warms up / is unreachable, slowly otherwise (keeps several tabs in sync).
  const warm = !!status?.ready && !offline;
  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (!running) refresh();
    }, warm ? 6000 : 2000);
    return () => clearInterval(id);
  }, [refresh, warm, running]);

  const runStage = useCallback(
    async (stage: StageName) => {
      setRunning(stage);
      try {
        await enginePost(`/api/run/${stage}`);
        await refresh();
      } catch (e: any) {
        notify(e.message, "error");
        await refresh();
        throw e;
      } finally {
        setRunning(null);
      }
    },
    [notify, refresh]
  );

  const runAll = useCallback(async () => {
    try {
      for (const s of ["clean", "vfm", "pta"] as StageName[]) {
        setStep(s);
        await runStage(s);
      }
      notify(t("workflow_complete"));
    } catch {
      /* already notified */
    }
  }, [runStage, notify, t]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const hasData = !!status?.parts.some((p) => p.kind === "high_freq");
  const isDone = (id: StepId) => {
    if (!status) return false;
    if (id === "data") return hasData;
    if (id === "model") return status.ready;
    if (id === "export") return status.stages.vfm === "done";
    if (id === "twin") return status.stages.pta === "done";
    return status.stages[id] === "done";
  };
  const isStale = (id: StepId) => !!status && (id === "clean" || id === "vfm" || id === "pta") && status.stages[id] === "stale";
  const enabled = (id: StepId) => {
    if (!status) return id === "data" || id === "model";
    if (id === "data" || id === "model" || id === "twin") return true;
    if (id === "clean") return hasData;
    if (id === "vfm") return status.stages.clean !== "idle";
    return status.stages.vfm !== "idle";
  };

  const doneCount = STEPS.reduce((n, s, i) => (STEPS.slice(0, i + 1).every((x) => isDone(x)) ? i + 1 : n), 0);
  useEffect(() => {
    if (fillRef.current) gsap.to(fillRef.current, { height: `${(Math.max(doneCount - 1, 0) / (STEPS.length - 1)) * 92}%`, duration: 0.9, ease: "expo.out" });
  }, [doneCount]);

  const reset = async () => {
    if (!confirm(t("reset_confirm"))) return;
    await enginePost("/api/reset");
    setStep("data");
    await refresh();
  };

  const engineState = offline ? "offline" : !status ? "connecting" : status.error ? "error" : status.ready ? "ready" : "loading";
  const next = (id: StepId) => () => setStep(id);
  const idx = STEPS.indexOf(step);

  return (
    <div className="wf" data-theme={theme} style={cssVars}>
      <div className={`wf-shell ${collapsed ? "is-collapsed" : ""}`}>
        <aside className="wf-rail">
          <div className="wf-between">
            <div className="wf-brand">
              <span className="wf-brand-dot" />
              <span className="wf-rail-text">WellPerf</span>
            </div>
            <div className="wf-rail-tools">
              {onHome && (
                <button className="wf-btn sm ghost" onClick={onHome} title={t("back_home")}>
                  <Home size={14} />
                </button>
              )}
              <button className="wf-btn sm ghost wf-rail-toggle" onClick={toggleRail} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
                {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>
            </div>
          </div>
          <div>
            <div className="label wf-rail-text" style={{ marginBottom: 14 }}>
              {t("workflow")}
            </div>
            <nav className="wf-steps">
              <div className="wf-steps-track" />
              <div className="wf-steps-fill" ref={fillRef} />
              {STEPS.map((s, i) => {
                const cls = isDone(s) ? "is-done" : isStale(s) ? "is-stale" : "";
                return (
                  <button key={s} className={`wf-step ${step === s ? "is-active" : ""} ${cls}`} onClick={() => setStep(s)} disabled={!enabled(s)} title={collapsed ? t(`s_${s}`) : undefined}>
                    <span className="wf-step-num mono">{cls === "is-done" && step !== s ? <Check size={14} /> : String(i + 1).padStart(2, "0")}</span>
                    <span className="wf-rail-text">
                      <div className="wf-step-title">{t(`s_${s}`)}</div>
                      <div className="wf-step-sub">{running === s ? t("running_dots") : t(`s_${s}_sub`)}</div>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="wf-rail-foot">
            {status?.period && (
              <div className="wf-card wf-rail-text" style={{ padding: 14 }}>
                <div className="label">{t("uploaded_period")}</div>
                <div className="mono" style={{ fontSize: 12, marginTop: 8 }}>
                  {fmtDate(status.period[0])}
                  <br />→ {fmtDate(status.period[1])}
                </div>
              </div>
            )}
            <div className="wf-row">
              <button className="wf-btn sm" onClick={() => setShowLog((v) => !v)}>
                <Terminal size={13} /> <span className="wf-rail-text">{t("log")}</span>
              </button>
              <button className="wf-btn sm ghost" onClick={reset}>
                <RotateCcw size={13} /> <span className="wf-rail-text">{t("reset")}</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="wf-main">
          <header className="wf-top">
            <div className="wf-row" style={{ gap: 14 }}>
              <span className="label">
                {String(idx + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t(`s_${step}`)}</span>
            </div>
            <div className="wf-row" style={{ gap: 16 }}>
              <button
                className="wf-btn sm"
                onClick={() => setShowTour(true)}
                style={{ gap: 6, fontSize: 12, height: 28 }}
                title="Application Requirements & Step-by-Step Onboarding Tour"
              >
                <Sparkles size={13} style={{ color: "var(--accent)" }} />
                <span>{lang === "az" ? "Bələdçi (Tour)" : lang === "ru" ? "Гид" : "Tour"}</span>
              </button>
              {running && (
                <span className="wf-row label" style={{ gap: 8 }}>
                  <span className="wf-dot live" /> {t("running")} · {t(`s_${running}`)}
                </span>
              )}
              <span className="wf-row label" style={{ gap: 8 }}>
                <span className={`wf-dot ${engineState === "ready" ? "live" : engineState === "loading" || engineState === "connecting" ? "warn" : "bad"}`} />
                {t("engine")} {t(`engine_${engineState}`)}
              </span>
              <PrefsControls compact />
            </div>
          </header>

          <div className="wf-content" ref={contentRef}>
            {offline && (
              <div className="wf-card" style={{ marginBottom: 28, borderColor: "var(--danger)" }}>
                <div style={{ fontWeight: 500 }}>{t("engine_unreachable")}</div>
                <div className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>
                  start-wellperf.bat · cd engine &amp;&amp; python -m uvicorn api_server:app --port 8000
                </div>
              </div>
            )}
            {status?.error && (
              <div className="wf-card" style={{ marginBottom: 28, borderColor: "var(--danger)" }}>
                {status.error}
              </div>
            )}

            {!status ? (
              <div style={{ display: "grid", gap: 18 }}>
                <Skeleton h={14} w={120} />
                <Skeleton h={70} w="60%" />
                <Skeleton h={18} w="45%" />
                <div className="wf-grid side" style={{ marginTop: 24 }}>
                  <Skeleton h={320} r={22} />
                  <Skeleton h={320} r={18} />
                </div>
              </div>
            ) : step === "data" ? (
              <StepData status={status} refresh={refresh} notify={notify} runAll={runAll} busy={!!running} goNext={next("clean")} />
            ) : step === "clean" ? (
              <StepClean status={status} run={() => runStage("clean").catch(() => {})} running={running === "clean"} goNext={next("model")} well={well} setWell={setWell} />
            ) : step === "model" ? (
              <StepModel goNext={next("vfm")} canNext={status.stages.clean !== "idle"} />
            ) : step === "vfm" ? (
              <StepVFM status={status} run={() => runStage("vfm").catch(() => {})} running={running === "vfm"} goNext={next("pta")} well={well} setWell={setWell} />
            ) : step === "pta" ? (
              <StepPTA status={status} run={() => runStage("pta").catch(() => {})} running={running === "pta"} goNext={next("twin")} notify={notify} refresh={refresh} />
            ) : step === "twin" ? (
              <StepTwin status={status} well={well} setWell={setWell} goVFM={next("vfm")} goPTA={next("pta")} />
            ) : (
              <StepExport status={status} onDownload={(n) => notify(t("e_downloading", { n }))} />
            )}

            {status && (step === "clean" || step === "vfm" || step === "twin") && (
              <FieldHeatmaps
                wells={Array.from(new Set([...(status.model?.wells || []), ...(status.meta.clean?.wells || [])])).sort()}
                show={step === "clean" ? ["sensors"] : step === "vfm" ? ["rates"] : ["rates", "sensors"]}
                ratesReady={status.stages.vfm === "done"}
                sensorsReady={status.stages.clean === "done"}
                ratesVer={`${status.meta.vfm?.rows}|${status.meta.vfm?.cum_oil}`}
                sensorsVer={`${status.period?.join("|")}|${status.meta.clean?.rows ?? ""}`}
                selected={well}
                onSelect={setWell}
              />
            )}
          </div>
        </main>
      </div>

      {showLog && status && (
        <div className="wf-card wf-pop" style={{ position: "fixed", right: 24, bottom: 24, width: 460, maxHeight: 360, overflow: "auto", zIndex: 50 }}>
          <div className="wf-between" style={{ marginBottom: 10 }}>
            <span className="label">{t("activity_log")}</span>
            <button className="wf-btn sm ghost" onClick={() => setShowLog(false)}>
              {t("close")}
            </button>
          </div>
          <div className="wf-log">
            {status.log.length === 0 && <div className="dim">{t("nothing_yet")}</div>}
            {[...status.log].reverse().map((l, i) => (
              <div key={i} className={l.level}>
                <span className="dim">{l.t.slice(11)}</span> {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className={`wf-toast ${toast.type === "error" ? "error" : ""}`}>{toast.text}</div>}

      <OnboardingTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        lang={lang.toUpperCase() as "AZ" | "EN" | "RU"}
        onSelectTab={(tabKey) => {
          if (tabKey === "data") setStep("data");
          else if (tabKey === "command") setStep("clean");
          else if (tabKey === "vfm") setStep("vfm");
          else if (tabKey === "pta") setStep("pta");
          else if (tabKey === "export") setStep("export");
        }}
      />
    </div>
  );
}
