"use client";

import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  LineChart,
  Cpu,
  Activity,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "AZ" | "EN" | "RU";
  onSelectTab: (tab: string) => void;
}

interface TourStep {
  id: string;
  tab: string;
  requirement: string;
  icon: any;
  accentColor: string;
  glowClass: string;
  badge: {
    AZ: string;
    EN: string;
    RU: string;
  };
  title: {
    AZ: string;
    EN: string;
    RU: string;
  };
  summary: {
    AZ: string;
    EN: string;
    RU: string;
  };
  focusMetric: {
    label: string;
    value: string;
    color: string;
  };
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "step-upload",
    tab: "data",
    requirement: "• Upload raw data",
    icon: UploadCloud,
    accentColor: "border-sky-500 text-sky-400 bg-sky-500/10",
    glowClass: "shadow-[0_0_60px_rgba(14,165,233,0.35)]",
    badge: {
      AZ: "Tələb 1 · Xam Məlumat Qəbulu",
      EN: "Req 1 · Raw Data Ingestion",
      RU: "Требование 1 · Загрузка Данных",
    },
    title: {
      AZ: "Xam Quyu Məlumatlarının Yüklənməsi",
      EN: "Upload Raw Well Telemetry Data",
      RU: "Загрузка Исходных Данных Скважин",
    },
    summary: {
      AZ: "Sensor və sınaq fayllarını (CSV/XLSX) birbaşa yükləyin. Sentinel (-999.25), donmuş sensorlar və sıçrayışlar avtomatik təmizlənir.",
      EN: "Drop raw sensor or well-test CSV/XLSX files. -999.25 sentinels, frozen runs, and noise spikes are filtered automatically.",
      RU: "Загружайте CSV/XLSX файлы телеметрии. Коды -999.25, зависания и шумы фильтруются автоматически.",
    },
    focusMetric: {
      label: "Cleaned Telemetry",
      value: "3,931,200 rows",
      color: "text-sky-400",
    },
  },
  {
    id: "step-visualize",
    tab: "command",
    requirement: "• Visualize field measurements",
    icon: LineChart,
    accentColor: "border-cyan-500 text-cyan-400 bg-cyan-500/10",
    glowClass: "shadow-[0_0_60px_rgba(6,182,212,0.35)]",
    badge: {
      AZ: "Tələb 2 · Sahə Ölçmələri",
      EN: "Req 2 · Field Measurements",
      RU: "Требование 2 · Визуализация Поля",
    },
    title: {
      AZ: "3D Sahə Telemetriyası və Ölçmə Zərfləri",
      EN: "Visualize Field Measurements & 3D Twin",
      RU: "Визуализация Измерений и 3D Двойник",
    },
    summary: {
      AZ: "10 dəniz quyusunun 3D modeli, gündəlik Pwf axın təzyiqi, qaz-lift inyeksiyası və qonşu quyuların qarşılıqlı təsiri.",
      EN: "Real-time 3D subsurface twin, daily downhole Pwf envelopes, annulus pressures, and gas-lift injection rates across 10 wells.",
      RU: "3D модель 10 скважин, суточные коридоры Pwf, затрубное давление и расходы газлифта в реальном времени.",
    },
    focusMetric: {
      label: "Offshore Wells",
      value: "10 Active Wells",
      color: "text-cyan-400",
    },
  },
  {
    id: "step-vfm",
    tab: "vfm",
    requirement: "• Predict production rates using VFM",
    icon: Cpu,
    accentColor: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
    glowClass: "shadow-[0_0_60px_rgba(16,185,129,0.35)]",
    badge: {
      AZ: "Tələb 3 · VFM Modelləri",
      EN: "Req 3 · VFM Rate Prediction",
      RU: "Требование 3 · Прогноз Дебитов VFM",
    },
    title: {
      AZ: "Fizika Əsaslı Virtual Flow Metering",
      EN: "Predict Production Rates using VFM",
      RU: "Прогноз Дебитов с Помощью VFM",
    },
    summary: {
      AZ: "Fiziki məhdudiyyətli BoundedRidge (dQ/dPwf ≤ -0.0002). WHP çıxarılaraq separator routing bias-ı aradan qaldırılıb (+0.7%).",
      EN: "Physics-constrained BoundedRidge regression. WHP excluded to eradicate test-separator routing bias (+0.7% bias, 3.72% MAPE).",
      RU: "Физически обоснованный BoundedRidge (dQ/dPwf ≤ -0.0002). Исключение WHP устранило сепараторное смещение.",
    },
    focusMetric: {
      label: "Forward Oil MAPE",
      value: "3.72%",
      color: "text-emerald-400",
    },
  },
  {
    id: "step-plots",
    tab: "pta",
    requirement: "• Generate well-test plots",
    icon: Activity,
    accentColor: "border-purple-500 text-purple-400 bg-purple-500/10",
    glowClass: "shadow-[0_0_60px_rgba(168,85,247,0.35)]",
    badge: {
      AZ: "Tələb 4 · Sınaq Diaqramları",
      EN: "Req 4 · Well-Test Diagnostic Plots",
      RU: "Требование 4 · Графики ГДИС",
    },
    title: {
      AZ: "Bourdet Loq-Loq & Horner Diaqramları",
      EN: "Generate Diagnostic Well-Test Plots",
      RU: "Диагностические Графики Бурде и Хорнера",
    },
    summary: {
      AZ: "Avtomatlaşdırılmış Bourdet loqarifmik təzyiq törəməsi və Horner semiloq qrafikləri. VFM-dən dinamik Qo və dəqiq tp inteqrasiyası.",
      EN: "Automated Bourdet log-log pressure derivative and Horner semilog plots with dynamic VFM Qo and cumulative tp integration.",
      RU: "Автоматические билогарифмические графики Бурде и полулогарифм Хорнера с дебитом Qo из модели VFM.",
    },
    focusMetric: {
      label: "PTA Events",
      value: "6 Build-Up Tests",
      color: "text-purple-400",
    },
  },
  {
    id: "step-estimate",
    tab: "pta",
    requirement: "• Estimate reservoir properties & behaviour",
    icon: Layers,
    accentColor: "border-amber-500 text-amber-400 bg-amber-500/10",
    glowClass: "shadow-[0_0_60px_rgba(245,158,11,0.35)]",
    badge: {
      AZ: "Tələb 5 · Kollektor Parametrləri",
      EN: "Req 5 · Reservoir Properties & Behaviour",
      RU: "Требование 5 · Свойства Пласта",
    },
    title: {
      AZ: "Kollektor Parametrləri & Qaz-Lift Optimizasiyası",
      EN: "Estimate Reservoir Properties & Behaviour",
      RU: "Оценка Параметров Пласта и Поведения",
    },
    summary: {
      AZ: "Keçiricilik (ko), Skin (s), p* və quyudibi saxlama effekti təyini. 14 İyun sınağı ilə qaz-lift paylanması: +$485,000/il ($0 CAPEX).",
      EN: "Estimate permeability (ko), skin factor (s), p*, wellbore storage, and unlock +$485k/yr via 14 June lift-gas optimization.",
      RU: "Оценка проницаемости (ko), скин-фактора (s), пластового давления p* и перераспределение газлифта (+$485k/год).",
    },
    focusMetric: {
      label: "Zero-CAPEX Uplift",
      value: "+$485K / yr",
      color: "text-amber-400",
    },
  },
  {
    id: "step-export",
    tab: "export",
    requirement: "• Export results and reports for VFM & PTA",
    icon: FileSpreadsheet,
    accentColor: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
    glowClass: "shadow-[0_0_60px_rgba(16,185,129,0.35)]",
    badge: {
      AZ: "Tələb 6 · Rəsmi Hesabatlar",
      EN: "Req 6 · Deliverables & Export",
      RU: "Требование 6 · Экспорт и Отчеты",
    },
    title: {
      AZ: "VFM & PTA Nəticələrinin İxracı",
      EN: "Export Results & Reports (VFM & PTA)",
      RU: "Экспорт Результатов и Отчетов",
    },
    summary: {
      AZ: "task.pdf tələblərinə tam uyğun 4 rəsmi fayl: 2730 sətirli CSV, audit Excel kitabı və interaktiv offline Plotly HTML diaqramları.",
      EN: "100% compliant deliverables: 2,730-row VFM CSV, full audit Excel workbook, PTA CSV, and offline standalone Plotly HTML reports.",
      RU: "Полное соответствие заданию: официальный CSV (2730 строк), книга Excel, CSV по PTA и автономные HTML-графики.",
    },
    focusMetric: {
      label: "Official Deliverables",
      value: "4 Verified Files",
      color: "text-emerald-400",
    },
  },
];

export function OnboardingTour({
  isOpen,
  onClose,
  lang,
  onSelectTab,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const step = TOUR_STEPS[currentStep];
    if (step) {
      onSelectTab(step.tab);
    }
  }, [currentStep, isOpen, onSelectTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("wellperf_tour_completed", "true");
    onClose();
  };

  const handleComplete = () => {
    localStorage.setItem("wellperf_tour_completed", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
      {/* =================================================================== */}
      {/* TRUE SPOTLIGHT EFFECT: HEAVILY BLURRED & DARKENED BACKGROUND       */}
      {/* =================================================================== */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-all duration-300"
        onClick={handleSkip}
      />

      {/* =================================================================== */}
      {/* SHARP, LUMINOUS SPOTLIGHT CARD (All attention is concentrated here) */}
      {/* =================================================================== */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-lg rounded-2xl border ${step.accentColor.split(" ")[0]} bg-[#031522] p-6 sm:p-8 text-zinc-100 shadow-2xl ${step.glowClass} z-10 transition-all duration-300 animate-in fade-in zoom-in-95`}
      >
        {/* Top Focus Header: Requirement Pill & Skip */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300">
              {step.requirement}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
              title={lang === "AZ" ? "Bağla / Keç" : "Skip"}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Core Spotlight Content (Clean & Punchy) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${step.accentColor}`}>
              <StepIcon className="size-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                {step.badge[lang]}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {step.title[lang]}
              </h3>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed font-normal">
            {step.summary[lang]}
          </p>

          {/* Prominent Focused Metric Callout */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
            <span className="text-xs text-zinc-400 font-mono">
              Key Architecture Value:
            </span>
            <span className={`text-base font-mono font-bold ${step.focusMetric.color}`}>
              {step.focusMetric.value}
            </span>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between gap-4 mt-7 pt-5 border-t border-white/10">
          {/* Progress Indicator */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? "w-7 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    : "w-2 bg-zinc-700 hover:bg-zinc-500"
                }`}
                title={`Step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-white transition"
            >
              {lang === "AZ" ? "İmtina et" : "Skip"}
            </button>

            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
              >
                <ArrowLeft className="size-3.5" />
                <span>{lang === "AZ" ? "Geri" : "Back"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition shadow-lg font-mono"
            >
              <span>
                {isLast
                  ? lang === "AZ"
                    ? "Tətbiqi Başlat"
                    : "Get Started"
                  : lang === "AZ"
                  ? "Növbəti"
                  : "Next"}
              </span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
