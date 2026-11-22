"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICT, Lang } from "./i18n";
import { setDateLocale } from "./api";

export type Theme = "dark" | "light";
export type AccentKey = "navy" | "lime" | "cyan" | "amber" | "violet" | "coral";

export const ACCENTS: Record<AccentKey, { dark: string; light: string; ink: string; name: string }> = {
  navy: { dark: "#dfe7ef", light: "#0f2a44", ink: "#0a1724", name: "Navy" },
  lime: { dark: "#d8ff3e", light: "#5b7a00", ink: "#0b0c0e", name: "Lime" },
  cyan: { dark: "#3ee0ff", light: "#0077a8", ink: "#05141a", name: "Cyan" },
  amber: { dark: "#ffb23e", light: "#b35a00", ink: "#1a1003", name: "Amber" },
  violet: { dark: "#b69bff", light: "#5b3fd6", ink: "#120a26", name: "Violet" },
  coral: { dark: "#ff7a5c", light: "#c2401f", ink: "#1f0904", name: "Coral" },
};

export interface Palette {
  bg: string;
  panel: string;
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  oil: string;
  water: string;
  gas: string;
  press: string;
  deriv: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
}

function palette(theme: Theme, accent: AccentKey): Palette {
  const a = ACCENTS[accent];
  const acc = theme === "dark" ? a.dark : a.light;
  const soft = (hex: string, alpha: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  };
  if (theme === "light")
    return {
      bg: "#ffffff", panel: "#eef1f4", ink: "#0f2a44", ink2: "#47596d", ink3: "#8a97a6", grid: "rgba(15,42,68,.08)",
      accent: acc, accentInk: "#ffffff", accentSoft: soft(acc, 0.1),
      oil: "#16a34a", water: "#2563eb", gas: "#ea580c", press: "#0f2a44", deriv: "#db2777",
      danger: "#dc2626", dangerSoft: "rgba(220,38,38,.12)", warn: "#d97706", warnSoft: "rgba(217,119,6,.14)",
    };
  return {
    bg: "#0a0e14", panel: "#121821", ink: "#e6ebf2", ink2: "#9aa6b6", ink3: "#5f6b7b", grid: "rgba(148,163,184,.07)",
    accent: acc, accentInk: a.ink, accentSoft: soft(acc, 0.1),
    oil: "#2dd4a7", water: "#4f9dff", gas: "#ff9a3c", press: "#dbe2ea", deriv: "#a78bfa",
    danger: "#ff6b5b", dangerSoft: "rgba(255,107,91,.22)", warn: "#fbbf24", warnSoft: "rgba(251,191,36,.2)",
  };
}

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  pal: Palette;
  cssVars: React.CSSProperties;
}

const Ctx = createContext<Prefs | null>(null);

function load<T extends string>(key: string, fallback: T, allowed: readonly string[]): T {
  try {
    const v = localStorage.getItem(key);
    if (v && allowed.includes(v)) return v as T;
  } catch {}
  return fallback;
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangS] = useState<Lang>("az");
  const [theme, setThemeS] = useState<Theme>("dark");
  const [accent, setAccentS] = useState<AccentKey>("amber");

  useEffect(() => {
    setLangS(load("wp_lang", "az", ["az", "en", "ru"]));
    // v3 keys: the workspace moved to a dark control-room default; older saved choices are not carried over.
    setThemeS(load("wp_theme3", "dark", ["dark", "light"]));
    setAccentS(load("wp_accent3", "amber", Object.keys(ACCENTS)));
  }, []);

  const persist = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  const value = useMemo<Prefs>(() => {
    const pal = palette(theme, accent);
    setDateLocale(lang);
    const dict = DICT[lang];
    const t = (key: string, vars?: Record<string, string | number>) => {
      let s = dict[key] ?? DICT.en[key] ?? key;
      if (vars) Object.entries(vars).forEach(([k, v]) => (s = s.split(`{${k}}`).join(String(v))));
      return s;
    };
    const cssVars = {
      "--accent": pal.accent,
      "--accent-ink": pal.accentInk,
      "--accent-soft": pal.accentSoft,
    } as React.CSSProperties;
    return {
      lang,
      setLang: (l) => (setLangS(l), persist("wp_lang", l)),
      theme,
      setTheme: (x) => (setThemeS(x), persist("wp_theme3", x)),
      accent,
      setAccent: (a) => (setAccentS(a), persist("wp_accent3", a)),
      t,
      pal,
      cssVars,
    };
  }, [lang, theme, accent]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs outside PrefsProvider");
  return c;
}

/** Language, theme and accent controls — used in the landing nav and the workspace top bar. */
export function PrefsControls({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, theme, setTheme, accent, setAccent, t } = usePrefs();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div className="wf-row" style={{ gap: 8 }}>
        <div className="wf-tabs" role="group" aria-label={t("pref_language")}>
          {(["az", "en", "ru"] as Lang[]).map((l) => (
            <button key={l} className={`wf-tab ${lang === l ? "on" : ""}`} style={{ height: 26, padding: "0 10px", fontSize: 11.5 }} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="wf-btn sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} title={t("pref_appearance")}>
          <span className="wf-dot" style={{ background: "var(--accent)", width: 9, height: 9 }} />
          {!compact && t("pref_appearance")}
        </button>
      </div>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 70 }} onClick={() => setOpen(false)} />
          <div className="wf-card wf-pop" style={{ position: "absolute", right: 0, top: 40, width: 260, zIndex: 71 }}>
            <div className="label">{t("pref_theme")}</div>
            <div className="wf-tabs" style={{ marginTop: 10, width: "100%" }}>
              {(["dark", "light"] as Theme[]).map((x) => (
                <button key={x} className={`wf-tab ${theme === x ? "on" : ""}`} style={{ flex: 1 }} onClick={() => setTheme(x)}>
                  {t(`theme_${x}`)}
                </button>
              ))}
            </div>
            <div className="label" style={{ marginTop: 18 }}>
              {t("pref_accent")}
            </div>
            <div className="wf-row" style={{ marginTop: 10, gap: 10 }}>
              {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                <button
                  key={k}
                  title={ACCENTS[k].name}
                  onClick={() => setAccent(k)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: theme === "dark" ? ACCENTS[k].dark : ACCENTS[k].light,
                    border: accent === k ? "2px solid var(--ink)" : "2px solid transparent",
                    boxShadow: accent === k ? "0 0 0 3px var(--bg)" : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
