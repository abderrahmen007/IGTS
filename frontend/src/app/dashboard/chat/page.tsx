"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Card, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: { id: number; titre: string }[];
  error?: boolean;
}

const SUGGESTIONS = [
  "Quelles sont mes obligations en matière de médecine du travail ?",
  "Quels textes concernent la gestion des déchets ?",
  "Dois-je réaliser un audit énergétique ?",
  "Quelles règles s’appliquent au travail de nuit ?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api<{ answer: string; sources: Message["sources"]; unavailable?: boolean }>("/chatbot/ask", {
        method: "POST",
        body: { question: q },
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

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col lg:h-[calc(100dvh-9rem)]">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink-950 sm:text-[22px]">Assistant juridique</h1>
        <p className="mt-1 text-sm text-ink-600">
          Posez une question : l’assistant répond uniquement à partir des textes de votre veille et cite ses sources.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm font-medium text-ink-800">Exemples de questions</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    className="rounded-md border border-ink-200 px-3.5 py-3 text-left text-[13.5px] text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-line rounded-lg bg-brand-800 px-4 py-2.5 text-sm text-white">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%]">
                    <p
                      className={cn(
                        "whitespace-pre-line text-[14.5px] leading-relaxed",
                        m.error ? "text-warn-700" : "text-ink-900",
                      )}
                    >
                      {m.text}
                    </p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-l-2 border-ink-200 pl-3">
                        <p className="text-xs font-medium text-ink-500">Sources</p>
                        <ol className="mt-1 space-y-1">
                          {m.sources.map((s, j) => (
                            <li key={s.id} className="text-[13px]">
                              <span className="tabular mr-1.5 text-ink-400">[{j + 1}]</span>
                              <Link href={`/dashboard/my-texts/${s.id}`} className="text-brand-700 hover:underline">
                                {s.titre}
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </div>
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
                  Recherche dans vos textes…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-ink-150 p-3">
          <div className="flex items-end gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              maxLength={1000}
              placeholder="Votre question…"
              aria-label="Votre question"
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={input.trim().length < 3} loading={loading} aria-label="Envoyer">
              {!loading && <Icon name="send" size={14} />}
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-ink-400">
            Réponses indicatives, générées localement. Vérifiez toujours le texte officiel.
          </p>
        </form>
      </Card>
    </div>
  );
}
