"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowUp, Check, Copy, MessageSquareText, Plus, Square, X } from "lucide-react";
import { ENGINE_URL, engineGet } from "./api";
import { usePrefs } from "./prefs";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
const STORE = "wp_chat_v1";

/** Minimal, safe markdown: headings, bullets, numbered lists, **bold**, `code`. */
function Md({ text }: { text: string }) {
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={k + i}>{p.slice(2, -2)}</strong>
      ) : p.startsWith("`") && p.endsWith("`") ? (
        <code key={k + i}>{p.slice(1, -1)}</code>
      ) : (
        <React.Fragment key={k + i}>{p}</React.Fragment>
      )
    );
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(
      <L key={"l" + blocks.length}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>
        ))}
      </L>
    );
    list = null;
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const b = line.match(/^\s*[*-]\s+(.*)$/);
    const n = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (b || n) {
      const ordered = !!n;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((b || n)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<h4 key={i}>{inline(h[1], "h" + i)}</h4>);
    else blocks.push(<p key={i}>{inline(line, "p" + i)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

export function AiChat() {
  const { t, lang, theme, cssVars } = usePrefs();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "[]");
      if (Array.isArray(saved)) setMsgs(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
    } catch {}
  }, [msgs]);
  useEffect(() => {
    if (open && configured === null)
      engineGet("/api/chat/status")
        .then((s) => setConfigured(!!s.configured))
        .catch(() => setConfigured(false));
  }, [open, configured]);

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    gsap.fromTo(panel.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "expo.out" });
    gsap.fromTo(panel.current.querySelectorAll(".ai-reveal"), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "expo.out", delay: 0.1 });
    setTimeout(() => ta.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    let acc = "";
    const put = (content: string, error = false) =>
      setMsgs((cur) => {
        const next = [...cur];
        next[next.length - 1] = { role: "assistant", content, error };
        return next;
      });
    try {
      const res = await fetch(`${ENGINE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() || "";
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const d = JSON.parse(line.slice(5));
          if (d.model) setModel(d.model);
          if (d.text) {
            acc += d.text;
            put(acc);
          }
          if (d.error) throw new Error(d.error);
        }
      }
      if (!acc) put(t("chat_empty"), true);
    } catch (e: any) {
      if (e.name === "AbortError") put(acc || t("chat_stopped"), !acc);
      else put(acc ? `${acc}\n\n— ${e.message}` : `${t("chat_error")} ${e.message}`, !acc);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const suggestions = [t("chat_s1"), t("chat_s2"), t("chat_s3"), t("chat_s4")];

  return (
    <div className="wf ai-root" data-theme={theme} style={cssVars}>
      {!open && (
        <button className="ai-launch" onClick={() => setOpen(true)} aria-label={t("chat_open")} title={`${t("chat_open")} · Ctrl+K`}>
          <MessageSquareText size={18} />
          <span>{t("chat_title")}</span>
        </button>
      )}
      {open && (
        <aside className="ai-panel" ref={panel} role="dialog" aria-label={t("chat_title")}>
          <header className="ai-head">
            <div className="ai-brand">
              <span className="ai-mark">✳</span>
              <div>
                <div className="ai-title">{t("chat_title")}</div>
                <div className="ai-sub">{model ? `Gemini · ${model}` : t("chat_sub")}</div>
              </div>
            </div>
            <div className="wf-row" style={{ gap: 4 }}>
              <button className="wf-btn sm ghost" onClick={() => !busy && setMsgs([])} title={t("chat_new")} disabled={busy || !msgs.length}>
                <Plus size={14} />
              </button>
              <button className="wf-btn sm ghost" onClick={() => setOpen(false)} aria-label={t("close")}>
                <X size={15} />
              </button>
            </div>
          </header>

          <div className="ai-scroll" ref={scroller}>
            {msgs.length === 0 ? (
              <div className="ai-empty">
                <div className="ai-mark big ai-reveal">✳</div>
                <h3 className="ai-reveal">{t("chat_hello")}</h3>
                <p className="ai-reveal">{configured === false ? t("chat_nokey") : t("chat_intro")}</p>
                <div className="ai-sugg">
                  {suggestions.map((s) => (
                    <button key={s} className="ai-chip ai-reveal" onClick={() => send(s)} disabled={configured === false}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ai-msg user">
                    <div className="ai-bubble">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className={`ai-msg bot ${m.error ? "err" : ""}`}>
                    <span className="ai-mark sm">✳</span>
                    <div className="ai-body">
                      {m.content ? <Md text={m.content} /> : <span className="ai-typing"><i /><i /><i /></span>}
                      {busy && i === msgs.length - 1 && m.content && <span className="ai-caret" />}
                      {m.content && !m.error && !(busy && i === msgs.length - 1) && (
                        <button
                          className="ai-copy"
                          onClick={() => {
                            navigator.clipboard?.writeText(m.content);
                            setCopied(i);
                            setTimeout(() => setCopied(null), 1400);
                          }}
                        >
                          {copied === i ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              )
            )}
          </div>

          <form
            className="ai-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={ta}
              rows={1}
              value={input}
              placeholder={t("chat_placeholder")}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {busy ? (
              <button type="button" className="ai-send" onClick={() => abort.current?.abort()} aria-label={t("chat_stop")}>
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" className="ai-send" disabled={!input.trim() || configured === false} aria-label={t("chat_send")}>
                <ArrowUp size={16} />
              </button>
            )}
          </form>
          <div className="ai-foot">{t("chat_foot")}</div>
        </aside>
      )}
    </div>
  );
}
