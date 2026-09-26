"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { cn } from "./ui";
import { api, ApiError } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: { id: number; titre: string }[];
  error?: boolean;
}

const STORE = "igts.assistant";
const GENERAL = [
  "Quelles sont mes obligations en médecine du travail ?",
  "Quels textes concernent la gestion des déchets ?",
  "Dois-je faire un audit énergétique ?",
];
const ABOUT_TEXT = [
  "Explique-moi ce texte simplement",
  "Qu’est-ce que ce texte m’oblige à faire ?",
  "Quelles preuves garder pour être en règle ?",
];

function load(): { messages: Message[]; greeted: boolean } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { messages: [], greeted: false };
}

function save(state: { messages: Message[]; greeted: boolean }) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * Legal assistant docked at the bottom-right of every company page. It
 * introduces itself automatically once per session and, on a text page,
 * offers to explain that specific text.
 */
export function AssistantWidget() {
  const pathname = usePathname();
  const textId = /^\/dashboard\/my-texts\/(\d+)/.exec(pathname)?.[1];
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [greeted, setGreeted] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore the conversation and show the greeting once per browser session
  useEffect(() => {
    const s = load();
    setMessages(s.messages);
    setGreeted(s.greeted);
    if (!s.greeted) {
      const t = window.setTimeout(() => setTeaser(true), 2500);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => save({ messages, greeted }), [messages, greeted]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ block: "end" });
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, messages, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    setTeaser(false);
    setGreeted(true);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api<{ answer: string; sources: Message["sources"]; unavailable?: boolean }>("/chatbot/ask", {
        method: "POST",
        body: { question: q, texteSocieteId: textId ? Number(textId) : undefined },
      });
      setMessages((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources, error: res.unavailable }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: e instanceof ApiError ? e.message : "Une erreur est survenue.", error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
    }
  };

  const suggestions = textId ? ABOUT_TEXT : GENERAL;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-3 p-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:p-0">
      {/* Greeting bubble */}
      {teaser && !open && (
        <div className="animate-[rise_220ms_ease-out] pointer-events-auto relative w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-ink-200 bg-white p-4 shadow-xl">
          <button
            onClick={() => {
              setTeaser(false);
              setGreeted(true);
            }}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Fermer"
          >
            <Icon name="x" size={15} />
          </button>
          <p className="pr-6 text-[15px] font-semibold text-ink-950">Bonjour, je suis votre assistant IGTS</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Une question sur vos obligations ? Je réponds à partir des textes de votre veille, en français simple.
          </p>
          <button
            onClick={openPanel}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-brand-800 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Poser une question
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <section
          role="dialog"
          aria-label="Assistant juridique"
          className="animate-[rise_200ms_ease-out] pointer-events-auto flex h-[min(620px,calc(100dvh-5.5rem))] w-full flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl sm:w-[400px]"
        >
          <header className="flex items-center gap-3 bg-brand-900 px-4 py-3 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Icon name="message" size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Assistant juridique</p>
              <p className="text-xs text-white/65">Répond à partir de vos textes</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="rounded-md px-2 py-1 text-xs text-white/75 hover:bg-white/10 hover:text-white"
              >
                Effacer
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Réduire l’assistant"
            >
              <Icon name="chevronDown" size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div>
                <p className="text-[15px] leading-relaxed text-ink-800">
                  {textId
                    ? "Je peux vous expliquer le texte que vous consultez. Que voulez-vous savoir ?"
                    : "Posez votre question comme vous la poseriez à un conseiller. Par exemple :"}
                </p>
                <div className="mt-4 space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="block w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-left text-sm text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-brand-800 px-3.5 py-2 text-sm text-white">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div key={i} className="max-w-[95%]">
                      <p className={cn("whitespace-pre-line text-[14.5px] leading-relaxed", m.error ? "text-warn-700" : "text-ink-900")}>
                        {m.text}
                      </p>
                      {m.sources && m.sources.length > 0 && (
                        <ol className="mt-2 space-y-1 border-l-2 border-ink-200 pl-3">
                          {m.sources.map((s, j) => (
                            <li key={s.id} className="text-[13px]">
                              <span className="tabular mr-1 text-ink-400">[{j + 1}]</span>
                              <Link href={`/dashboard/my-texts/${s.id}`} className="text-brand-700 hover:underline">
                                {s.titre}
                              </Link>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ),
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-[13px] text-ink-500">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400"
                          style={{ animationDelay: `${d * 150}ms` }}
                        />
                      ))}
                    </span>
                    Je cherche dans vos textes…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-ink-150 p-3">
            <div className="flex items-end gap-2 rounded-lg border border-ink-200 px-3 py-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                maxLength={1000}
                placeholder="Écrivez votre question…"
                aria-label="Votre question"
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={input.trim().length < 3 || loading}
                aria-label="Envoyer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white hover:bg-brand-700 disabled:opacity-40"
              >
                <Icon name="send" size={14} />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-ink-400">Réponses indicatives. Vérifiez toujours le texte officiel.</p>
          </form>
        </section>
      )}

      {/* Launcher */}
      {!open && (
        <button
          onClick={openPanel}
          className="pointer-events-auto inline-flex h-12 items-center gap-2 self-end rounded-full bg-brand-800 pl-4 pr-5 text-sm font-medium text-white shadow-lg shadow-brand-900/25 transition-transform hover:scale-[1.03] hover:bg-brand-700 active:scale-100"
          aria-label="Ouvrir l’assistant juridique"
        >
          <Icon name="message" size={18} />
          <span>{textId ? "Une question sur ce texte ?" : "Une question ?"}</span>
        </button>
      )}
    </div>
  );
}
